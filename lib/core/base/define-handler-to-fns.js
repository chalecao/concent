"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports["default"] = _default;

var _util = require("../../support/util");

var _constant = require("../../support/constant");

var _ccContext = _interopRequireDefault(require("../../cc-context"));

var moduleName_stateKeys_ = _ccContext["default"].moduleName_stateKeys_;
/**
  computed({
    'foo/firstName': ()=>{},
    'foo/fullName':{
      fn:()=>{},
      depKeys:['firstName', 'lastName']
    },
    'foo/bala':{
      fn:()=>{},
      depKeys:'*'
    }
  })
-----------------------------------
  computed('foo/firstName', ()=>{});
  computed('foo/fullName', ()=>{}, ['firstName', 'lastName']);
  computed('foo/bala', ()=>{}, '*');


watch({
  'foo/a':{
    fn:()=>{},
    immediate: true,
  },
  'foo/whatever':{
    fn:()=>{},
    immediate: true,
    depKeys:['a', 'b', 'c']
  }
})
-----------------------------------
watch('foo/a', ()=>{}, true);
watch('foo/whatever', ()=>{}, true, ['firstName', 'lastName']);

*/

function _default(refCtx, item, handler, fns, immediate, depStateKeys, depFn, type) {
  if (!item) return;
  var itype = typeof item;

  if (itype === 'object') {
    parseDescObj(refCtx, item, fns, depFn, type);
    return;
  }

  if (itype === 'function') {
    var ret = item(refCtx);
    if (!ret) return;

    if (typeof ret === 'object') {
      parseDescObj(refCtx, ret, fns, depFn, type);
      return;
    }

    throw new Error("type of computed or watch callback result must be an object.");
  }

  if (itype === 'string') {
    var key = item;

    if (depStateKeys) {
      mapDepDesc(refCtx, key, handler, depFn, depStateKeys, immediate, type);
      flagHasFn(refCtx, type);
      return;
    }

    mapNormalDesc(refCtx, fns, key, handler, immediate, type);
  }
}

;

function mapNormalDesc(refCtx, fns, key, handler, immediate, type) {
  getModuleAndRetKey(refCtx, key);

  if (fns[key]) {
    throw new Error("key[" + key + "] already declared!");
  }

  fns[key] = handler;

  if (type === 2 && immediate) {
    refCtx.immediateWatchKeys.push(key);
  }

  flagHasFn(refCtx, type);
}

function flagHasFn(refCtx, type) {
  if (type === 1) refCtx.hasComputedFn = true;else refCtx.hasWatchFn = true;
}

function parseDescObj(refCtx, descObj, fns, depFn, type) {
  var keys = (0, _util.okeys)(descObj);

  if (keys.length > 0) {
    flagHasFn(refCtx, type);
    keys.forEach(function (key) {
      var val = descObj[key];
      var vType = typeof val;

      if (vType === 'function') {
        fns[key] = val;
        return;
      }

      if (vType === 'object') {
        var fn = val.fn,
            depKeys = val.depKeys,
            immediate = val.immediate;

        if (!depKeys) {
          //当普通的computed来映射
          mapNormalDesc(refCtx, fns, key, fn, immediate, type);
          return;
        } //当依赖型的computed来映射


        mapDepDesc(refCtx, key, fn, depFn, depKeys, immediate, type);
      }
    });
  }
} // 映射依赖描述对象


function mapDepDesc(refCtx, key, fn, depFn, depKeys, immediate, type) {
  var _getModuleAndRetKey = getModuleAndRetKey(refCtx, key, false),
      module = _getModuleAndRetKey.module,
      retKey = _getModuleAndRetKey.retKey;

  var moduleDepDesc = (0, _util.safeGetObjectFromObject)(depFn, module, {
    stateKey_retKeys_: {},
    retKey_fn_: {},
    fnCount: 0
  });
  var stateKey_retKeys_ = moduleDepDesc.stateKey_retKeys_,
      retKey_fn_ = moduleDepDesc.retKey_fn_;

  if (retKey_fn_[retKey]) {
    throw new Error("key[" + retKey + "] already declared!");
  }

  var _depKeys = depKeys;

  if (depKeys === '*') {
    _depKeys = ['*'];
  }

  if (!Array.isArray(_depKeys)) {
    throw new Error("depKeys can only be an Array<string> or string *");
  }

  if (type === 2 && immediate) {
    refCtx.immediateWatchKeys.push(key);
  }

  retKey_fn_[retKey] = fn;
  moduleDepDesc.fnCount++;

  _depKeys.forEach(function (sKey) {
    //一个依赖key列表里的stateKey会对应着多个结果key
    var retKeys = (0, _util.safeGetArrayFromObject)(stateKey_retKeys_, sKey);
    retKeys.push(retKey);
  });
} // retKey作为将计算结果映射到refComputed | moduleComputed 里的key


function getModuleAndRetKey(refCtx, key, mustInclude) {
  if (mustInclude === void 0) {
    mustInclude = true;
  }

  var _module = refCtx.module,
      _retKey = key,
      _stateKeys;

  if (key.includes('/')) {
    var _key$split = key.split('/'),
        module = _key$split[0],
        retKey = _key$split[1];

    _module = module;
    _retKey = retKey;
  }

  if (_module === refCtx.module) {
    // 此时computed & watch可能观察的私有的stateKey
    _stateKeys = (0, _util.okeys)(refCtx.state);
  } else {
    _stateKeys = moduleName_stateKeys_[_module];

    if (!_stateKeys) {
      throw (0, _util.makeError)(_constant.ERR.CC_MODULE_NOT_FOUND, (0, _util.verboseInfo)("module[" + _module + "]"));
    }
  }

  var includeKey = _stateKeys.includes(_retKey);

  if (mustInclude) {
    if (!includeKey) {
      throw new Error("key[" + _retKey + "] is not declared in module[" + _module + "] or selfState");
    }
  } else {
    //传递了depKeys，_retKey不能再是stateKey
    if (includeKey) {
      throw new Error("retKey[" + _retKey + "] can not be stateKey of module[" + _module + "] or selfState if you declare depKeys");
    }
  }

  return {
    module: _module,
    retKey: _retKey
  };
}