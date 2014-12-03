﻿/******************************************************************************
 *  SQLite 数据库操作工具 
 *  默认具备 CRUD操作方式 以及相关基本数据库操作方法
 *  同时包含事务处理机制
 *****************************************************************************/
var path = require("path"),
    async = require('async'),
    framework = require('framework'),
    sqlite3 = require("sqlite3");

//SQLite数据快捷库操作工具
var SQLiteInnerAccessor = function () { this.init.apply(this, arguments); }

SQLiteInnerAccessor.prototype.Env = framework;
//带有事务的数据操作
SQLiteInnerAccessor.prototype.transList = ['insert', 'update', 'delete', 'execute'];
//监听类型列表
SQLiteInnerAccessor.prototype.observerTypes = ["SELECT", "UPDATE", "DELETE", "INIT", "INSERT", "COMMIT", "ROLLBACK", "TRANSFINAL"];
//SQLite操作工具初始化 tablename:表名 transOrConnect:是否手动事务或者连接字符串 options：其他配置
SQLiteInnerAccessor.prototype.init = function (tablename, transOrConnect, options) {
    //初始化初始字段
    this.initPropertys(tablename, transOrConnect, options);
    //初始化先关依赖引用
    this.initUsingRequires(transOrConnect);
    //实例化数据库以及字段信息
    this.createdb(transOrConnect, options);
    //初始化优先级队列
    this.initLevelHandlers();
    //初始化完毕
    this.initFinal();
}
//初始化相关属性
SQLiteInnerAccessor.prototype.initPropertys = function (_tablename, trans, options) {
    //表名
    this.tablename = _tablename;
    //存储当前表所有字段的元数据
    this.fields = [];
    //监听器
    this.observer = {};
    //是否已经开始事务队列捕获
    this.isBeginCatchTrans = false;
    //是否事务计数中
    this.isTransCaculing = false;
    //事务操作队列总数
    this.transTotal = 0;
    //事务操作队列计数器
    this.transCurrent = 0;
    //事务操作队列操作错误容器
    this.transErrors = [];
    //事务操作队列结束后处理函数队列
    this.afterTransHandlers = [];
}
//初始化引入数据库配置
SQLiteInnerAccessor.prototype.initUsingRequires = function (connect) {
    var c = this.checkQuestion = framework.CheckQuestion;
    this.sqlBuilder = require('./lib/sql.builder.js');
    if (c.isBoolean(connect) || c.isEmpty(connect)) {
        this.cfg = framework.Configuration;
    } else {
        this.cfg = { connectionString: connect };
    }
}
//初始化SQLite数据库对象
SQLiteInnerAccessor.prototype.createdb = function (trans, options) {
    var self = this;
    //如果不是自动提交事务
    if (trans != true) {
        self.db = self.checkQuestion.noInObj(global, 'sharedb', function () { return new sqlite3.Database(self.getConnString()); })
    } else {
        self.db = new sqlite3.Database(this.getConnString());
    }
}
//初始化最高优先级队列
SQLiteInnerAccessor.prototype.initLevelHandlers = function () {
    //最高优先级函数队列
    var handlers = this.topLevelHandlers = [];
    //最后执行的函数队列
    var afterHandlers = this.bottomLevelHandlers = [];
    var self = this;
    //添加获取字段元数据队列
    this.addTopLevel(function (callback) { self.readyFields(callback); });
    var _async = async;
    //所有语句操作处理队列 --在执行任何语句前 先获取元数据获取元数据后在指定语句操作
    self.cargo = _async.cargo(function (task, callback) {
        var handlers = Array.prototype.slice.call(self.topLevelHandlers, 0);
        self.clearTopLevels();
        _async.parallel(handlers, function (error, results) {
            if (error) {
                //如果必须执行的队列全部执行失败 则不允许操作队列执行 所以这里没有条用callback
                return framework.Log(error);
            }
            callback();
        });
    });
}
//清除最高优先级队列
SQLiteInnerAccessor.prototype.clearTopLevels = function () {
    this.topLevelHandlers.length = 0;
}
//清除最低优先级队列
SQLiteInnerAccessor.prototype.clearBottomLevels = function () {
    this.bottomLevelHandlers.length = 0;
}
//清除事务提交后或者回滚后 数据库操作队列
SQLiteInnerAccessor.prototype.clearAfterTrans = function () {
    this.afterTransHandlers.length = 0;
}
//添加事务提交或者回滚后的 数据库操作
SQLiteInnerAccessor.prototype.addAfterTrans = function (callback) {
    if (this.checkQuestion.isFunction(callback)) {
        this.afterTransHandlers.push(callback);
    }
}
//添加最高优先级队列
SQLiteInnerAccessor.prototype.addTopLevel = function (handle) {
    if (this.checkQuestion.isFunction(handle)) {
        this.topLevelHandlers.push(handle);
    }
}
//添加最低优先级队列 即最后执行
SQLiteInnerAccessor.prototype.addBottomLevel = function (handle) {
    if (this.checkQuestion.isFunction(handle)) {
        this.bottomLevelHandlers.push(handle);
    }
}
//加载字段元数据
SQLiteInnerAccessor.prototype.readyFields = function (callback) {
    var self = this;
    if (self.tablename == "none") { return self.Env.Call(callback); }
    self.query("PRAGMA table_info(`" + self.tablename + "`);", function (err, data) {
        if (err) {
            callback(err);
            return framework.Log(err);
        }
        self.fields = data.map(function (column) {
            return column.name;
        });
        if (self.fields == null || self.fields.length <= 0) {
            callback(framework.InfoMessageStrings.sqliteCannotReadFieldsString + " " + self.tablename);
        } else {
            framework.Log(framework.InfoMessageStrings.sqliteAccessorReadyString);
            callback();
        }
    });
}
//初始化完毕函数
SQLiteInnerAccessor.prototype.initFinal = function () {
    //初始化完毕后 删除相关初始化方法
    delete this.init;
    delete this.initPropertys;
    delete this.initUsingRequires;
    delete this.createdb;
    delete this.initFinal;
    delete this.initLevelHandlers;
}
//新增
SQLiteInnerAccessor.prototype.insert = function (dataObject, callback) {
    var self = this;
    var sql = this.sqlBuilder.buildInsertSQL(dataObject, self.tablename, self.fields);
    self.execute(sql, function (err, info) {
        self.dispatch("INSERT");
        self.Env.Call(callback, err, info);
    });
}
//修改
SQLiteInnerAccessor.prototype.update = function (dataObject, options, callback) {
    var self = this;
    var sql = self.sqlBuilder.buildSQLUpdateSQL(dataObject, self.tablename, self.fields, options);
    self.execute(sql, function (err, info) {
        self.dispatch("UPDATE");
        self.Env.Call(callback, err, info);
    });
}
//删除
SQLiteInnerAccessor.prototype.delete = function (options, callback) {
    var self = this;
    var sql = self.sqlBuilder.buildDeleteSQL(self.tablename, options);
    self.execute(sql, function (err, info) {
        self.dispatch("DELETE");
        self.Env.Call(callback, err, info);
    });
}
//查询
SQLiteInnerAccessor.prototype.select = function () {
    var self = this;
    var callback, options;
    if (this.checkQuestion.isFunction(arguments[0])) {
        callback = arguments[0];
    } else {
        options = arguments[0];
        callback = arguments[1];
    }
    var sql = self.sqlBuilder.buildSelectSQL(self.tablename, options);
    self.query(sql, function (err, dataset) {
        self.dispatch("SELECT");
        self.Env.Call(callback, err, dataset);
    });
}
//只读只进查询
SQLiteInnerAccessor.prototype.selectEach = function (options, callback, complete) {
    var self = this;
    var sql = self.sqlBuilder.buildSelectSQL(self.tablename, options);
    self.queryEach(sql, function (err, row) {
        process.nextTick(async.apply(callback, err, row));
    }, function (err, rows) {
        self.dispatch("SELECT");
        self.Env.Call(complete, err, rows);
    });
}
//开始事务
SQLiteInnerAccessor.prototype.transBegin = function (callback) {
    var self = this;
    if (self.isTransCaculing) {
        //事务已经开始 不允许重复操作
        throw framework.ErrorBuilder.Error(3000);
    }
    if (self.isBeginCatchTrans) { return; }
    self.initTrans();//初始化事务相关属性
    self.isBeginCatchTrans = true;//设置为已经开始事务
    self.addTopLevel(function (innerCall) {
        self.exec('begin transaction', function () {
            innerCall();
            self.Env.Call(callback);
        });
    });
}
//停止事务捕获 调用了此方法之后的所有数据库操作队列不计入事务，将会等待事务结束再执行
SQLiteInnerAccessor.prototype.transEnd = function (callback) {
    var self = this;
    if (!self.isBeginCatchTrans) { return; }
    self.stopTransCatchRender();
    //添加事务结束回调函数
    self.addBottomLevel(function (innerCall) {
        var errors = self.transErrors;
        errors = errors.length > 0?errors:null;
        var commit = errors == null;
        if (self.checkQuestion.isFunction(callback)) {
            commit = callback(errors);
        }
        var fn = function () { self.transFinalRender(); }
        if (commit === true) {
            self.commit(fn);
        } else {
            self.rollback(fn);
        }
        innerCall();
    });
}
//获取一个自维护函数 确认指定函数是否已调用
SQLiteInnerAccessor.prototype.GetNotifyCall = function (callback, context) {
    var self = this;
    var fn = function () {
        fn.executed = true;//标记为已执行
        self.Env.Call(callback);
    }
    return fn;
}
//提交事务
SQLiteInnerAccessor.prototype.commit = function (callback) {
    var self = this;
    self.stopTransCatchRender();
    self.exec('commit transaction', function () {
        self.Env.Call(callback);
        self.dispatch("COMMIT");
        self.transFinalRender();
    });
}
//回滚事务
SQLiteInnerAccessor.prototype.rollback = function (callback) {
    var self = this;
    self.stopTransCatchRender();
    self.exec('rollback transaction', function () {
        self.Env.Call(callback);
        self.dispatch("ROLLBACK");
        self.transFinalRender();
    });
}
//事务结束
SQLiteInnerAccessor.prototype.transFinalRender = function () {
    this.initTrans();
    var handlers = Array.prototype.slice.call(this.afterTransHandlers, 0);
    this.clearAfterTrans();
    for (var i = 0, k = handlers.length; i < k; i++) {
        this.cargo.push('after', handlers[i]);
    }
    this.startCargo();
}
//停止事务队列捕获
SQLiteInnerAccessor.prototype.stopTransCatchRender = function () {
    this.isTransCaculing = true;
    this.isBeginCatchTrans = false;//设置为事务结束
    this.stopCargo();
}
//初始化事务相关属性
SQLiteInnerAccessor.prototype.initTrans = function () {
    this.isBeginCatchTrans = false;
    this.transCurrent = 0;
    this.transTotal = 0;
    this.isTransCaculing = false;
    this.transErrors = [];
}
//事务结束监听
SQLiteInnerAccessor.prototype.transAsk = function (err, info) {
    var self = this;
    if (self.isTransCaculing) {
        if (err) {
            self.transErrors.push({ err: err, info: info });
        }
        self.transCurrent++;
        var current = self.transCurrent;
        var total = self.transTotal;
        if (total - current === 0) {
            self.transCurrent = 0;
            var handlers = Array.prototype.slice.call(self.bottomLevelHandlers, 0);
            self.clearBottomLevels();
            async.parallel(handlers);
        } else if (current > total) {
            //事务计数器不匹配
            throw framework.ErrorBuilder.Error(3001);
        }
    }
}
//停止后面操作队列执行
SQLiteInnerAccessor.prototype.stopCargo = function () {
    this.cargo.payload = 0;
}
//启动操作队列
SQLiteInnerAccessor.prototype.startCargo = function () {
    this.cargo.payload = null;
    this.cargo.process();
}
//带有事务监听的指定sql语句
SQLiteInnerAccessor.prototype.execute = function (sql, callback) {
    var self = this;
    self.query(sql, function (err, data) {
        self.Env.Call(callback, err, data);
        //事务监听
        self.transAsk(err, data);
    });
}
//指定指定sql语句查询
SQLiteInnerAccessor.prototype.query = function (sql, callback) {
    if (!this.tryConnect()) {
        //没有数据库连接,请检查是否配置连接路径
        return callback(framework.InfoMessageStrings.sqliteNoConnectionString);
    }
    var self = this;
    var proc = process;
    self.db.parallelize(function () {
        self.db.all(sql, function (err, data) {
            if (err) {
                framework.Log(err);
                proc.nextTick(self.apply(callback, err));
            }
            self.Env.Call(callback, err, data);
        });
    });
}
//指定指定sql语句并且遍历返回结果集每一项
//sql:查询语句 itemHandle:返回每行的处理函数 complete:查询完毕后汇总结果处理函数
SQLiteInnerAccessor.prototype.queryEach = function (sql, itemHandle, complete) {
    if (!this.tryConnect()) {
        //没有数据库连接,请检查是否配置连接路径
        return callback(framework.InfoMessageStrings.sqliteNoConnectionString);
    }
    var self = this;
    var proc = process;
    self.db.parallelize(function () {
        self.db.each(sql, function (err, row) {
            if (err) {
                framework.Log(err + '\r\n :' + sql);
                return proc.nextTick(self.apply(itemHandle, err, row));
            }
            return itemHandle(null, row);
        }, 
        function (err, rows) {
            if (err) {
                framework.Log(err);
                return proc.nextTick(self.apply(complete, err, rows));
            }
            return proc.nextTick(self.apply(complete, null, rows));
        });
    });
}
//调用SQLite 的exec方法 是否返回当前表所有字段
SQLiteInnerAccessor.prototype.exec = function (sql, callback, fields) {
    if (!this.tryConnect()) {
        //没有数据库连接,请检查是否配置连接路径
        return callback(framework.InfoMessageStrings.sqliteNoConnectionString);
    }
    var self = this;
    var db = self.db;
    var proc = process;
    db.parallelize(function () {
        db.exec(sql, function (err, data) {
            if (err) {
                framework.Log(err + '\r\n :' + sql);
                proc.nextTick(self.apply(callback, err));
            }
            else if (typeof fields === "undefined") {
                proc.nextTick(self.apply(callback, null, data));
            } else {
                proc.nextTick(self.apply(callback, null, data, self.keys(fields)));
            }
        });
    });
}
//添加队列处理 如果元数据没有加载完毕 则添加的队列会在元数据加载后调用
//如果元数据已经加载 则会立即调用
SQLiteInnerAccessor.prototype.addQueue = function (callback) {
    this.cargo.push('handle', callback);
}
//获取连接字符串
SQLiteInnerAccessor.prototype.getConnString = function () {
    return this.cfg.connectionString;
}
//注册监听函数 list:监听列表 可以是observerTypes所包含的类型 handle:当前监听列表处理函数
SQLiteInnerAccessor.prototype.addListener = function (list, handle) {
    var question = this.checkQuestion;
    list = question.isString(list)?[list]:list;
    if (!question.isArray(list) || !question.isFunction(handle)) {
        return;
    }
    var self = this;
    var observer = self.observer;
    async.each(list, function (item, callback) {
        var isContinue = false;
        if (!self.supportObserver(item)) {
            isContinue = true;
        }
        //如果是初始化监听事件 则立即执行
        if (item == "INIT") {
            isContinue = true;
            handle();
        }
        if (!isContinue) {
            //如果是其他监听事件 则加入事件列表中
            question.noInObj(observer, item, []).push(self.getCall(handle));
        }
    });
}
//执行指定消息事件
SQLiteInnerAccessor.prototype.dispatch = function (event, arg1, argN) {
    if (!this.supportObserver(event)) {
        return;
    }
    var self = this;
    var args = Array.prototype.slice.call(arguments, 1);
    var handlers = this.observer[event];
    if (this.checkQuestion.isArray(handlers)) {
        async.parallel(handlers, function (error, results) {
            if (error) {
                framework.Log(event + framework.InfoMessageStrings.sqliteListenerErrorString + error);
            }
        });
    }
}
//判断指定监听类型是否支持
SQLiteInnerAccessor.prototype.supportObserver = function (name) {
    return this.observerTypes.indexOf(name) >= 0;
}
//判断指定字段是否合法 field:字段名
SQLiteInnerAccessor.prototype.supportField = function (field) {
    if (this.validateFields()) {
        return false;
    }
    var v = this.fields.indexOf(field) >= 0;
    if (!v) {
        framework.Log(framework.InfoMessageStrings.sqliteIngoreFieldsString + ' ' + field);
    }
    return v;
}
//判断字段元数据是否已经加载 log:是否输出错误日志
SQLiteInnerAccessor.prototype.validateFields = function (log) {
    var fields = this.fields || [];
    var v = fields.length > 0;
    if (!v) {
        framework.Log(framework.InfoMessageStrings.sqliteNoFieldsString);
    }
    return v;
}
//检测当前数据库操作工具数据库是否可以存在连接对象
SQLiteInnerAccessor.prototype.tryConnect = function () {
    return this.db != null;
}
//包装async.apply
SQLiteInnerAccessor.prototype.apply = function (callback) {
    if (this.checkQuestion.isFunction(callback)) {
        return async.apply.apply(async, arguments);
    } else {
        return function () { };
    }
}
//创建一个错误对象
SQLiteInnerAccessor.prototype.error = function (message) {
    return new Error(message);
}
//获取异步事件串联或者并联回调包装函数
SQLiteInnerAccessor.prototype.getCall = function (handle, arg1, argN) {
    var args = Array.prototype.slice.call(arguments, 1);
    var checkQues = this.checkQuestion;
    return function (callback) {
        try {
            if (checkQues.isFunction(handle)) {
                handle.apply(null, args);
            }
            callback();
        } catch (ex) {
            callback(ex.message);
        }
    }
}
//数据库操作队列统一入口
SQLiteInnerAccessor.prototype.addAccessorHandle = function (method, argus) {
    var self = this;
    var args = Array.prototype.slice.call(argus);
    //如果是带有事务的方法
    if (self.transList.indexOf(method) > -1) {
        this.isBeginCatchTrans && (this.transTotal++);//计数参加事务的sql操作数量
        if (self.isTransCaculing) {
            return this.addAfterTrans(function (_call) {
                var fn = self[method];
                if (self.checkQuestion.isFunction(fn)) {
                    return fn.apply(self, args);
                }
                _call();
            });
        }
    }
    self.addQueue(function () {
        var fn = self[method];
        if (self.checkQuestion.isFunction(fn)) {
            return fn.apply(self, args);
        }
    });
}

//私有sql操作工具实例
var innerAccessor = null;

/****************公布公共调用方法：***************************/

//公布给模块外部的数据库操作类 注意:tablename：如果为'none'默认不获取元数据即不是针对指定表操作 而是针对整个数据操作
function SQLiteAccessor(tablename, transOrConnect, options) { init.apply(this, arguments); }

//开始事务
SQLiteAccessor.prototype.transBegin = function (callback) {
    return innerAccessor.transBegin(callback);
}
//结束事务队列执捕获同时支持回调(回调函数会在捕获的事务队列全部指定完毕后执行)
SQLiteAccessor.prototype.transEnd = function (callback) {
    return innerAccessor.transEnd(callback);
}
//回滚事务
SQLiteAccessor.prototype.rollback = function (callback) {
    return innerAccessor.rollback(callback);
}
//提交事务
SQLiteAccessor.prototype.commit = function (callback) {
    return innerAccessor.commit(callback);
}
//添加监听事件
SQLiteAccessor.prototype.addListener = function (list, callback) {
    return innerAccessor.addListener(list, callback);
}
//新增
SQLiteAccessor.prototype.insert = function (data, callback) {
    return innerAccessor.addAccessorHandle('insert', arguments);
}
//修改
SQLiteAccessor.prototype.update = function (data, options, callback) {
    return innerAccessor.addAccessorHandle('update', arguments);
}
//删除
SQLiteAccessor.prototype.delete = function (options, callback) {
    return innerAccessor.addAccessorHandle('delete', arguments);
}
//结果集查询
SQLiteAccessor.prototype.select = function (options, callback) {
    return innerAccessor.addAccessorHandle('select', arguments);
}
//只读只进查询
SQLiteAccessor.prototype.selectEach = function (options, callback, compelete) {
    return innerAccessor.addAccessorHandle('selectEach', arguments);
}

//直接指定sql语句
SQLiteAccessor.prototype.run = function (sql, callback) {
    return innerAccessor.addAccessorHandle('exec', arguments);
}

//私有初始化方法
function init(tablename, autoTrans, options) {
    if (tablename == null || tablename == '') {
        throw new Error('must set the tablename');
    }
    innerAccessor = new SQLiteInnerAccessor(tablename, autoTrans, options);
}

module.exports.SQLiteAccessor = SQLiteAccessor;