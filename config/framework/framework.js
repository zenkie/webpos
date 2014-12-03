﻿/******************************************************************************
 *  webpos 2.0 框架主类 
 *  相关方法以及类可以使用此模块进行访问与使用
 * 
 *****************************************************************************/
var path = require('path');
var util = require('util');


var Framework = function () { }

module.exports = new Framework();

//全局配置
Framework.prototype.Configuration = require('../.././config/configuration.js');

//检测工具
Framework.prototype.CheckQuestion = require('./lib/check.js');

//全局消息
Framework.prototype.InfoMessageStrings = require('./lib/locale/zh_CN.js');

//异常创建者
Framework.prototype.ErrorBuilder = require('./lib/exception.js');

//字符串操作辅助工具
Framework.prototype.String = require('./lib/string.js');

//增量数据同步
Framework.prototype.SyncDataIncrement = require('./lib/incremental.js');

//记录日志
Framework.prototype.Log = function (message) {
    util.log(message);
}

//获取程序运行根目录
Framework.prototype.GetAppDomainBaseDIR = function () {
    return this.CheckQuestion.noInObj(root, 'baseDIR', getReleativeAppDomainBaseDIR);
}

//安全指定传入函数，如果传入的不是函数类型 不引发异常 调用方式  this.Call(函数,参数1,参数2,....,参数N)  相当于：函数(参数1,参数2...参数N);
Framework.prototype.Call = function (fn, arg1, argN) {
    if (this.CheckQuestion.isFunction(fn)) {
        var args = Array.prototype.slice.call(arguments, 1);
        return fn.apply(null, args);
    }
}

//安全指定传入函数，如果传入的不是函数类型 不引发异常   this.Apply(函数,数组参数) 相当于: 函数(args[0],args[1],...args[N]);
Framework.prototype.Apply = function (fn, args) {
    if (this.CheckQuestion.isFunction(fn)) {
        return fn.apply(null, args);
    }
}

function getReleativeAppDomainBaseDIR() {
    return path.join(__dirname, '..', '..', './');
}