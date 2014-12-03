var sqlstrutil = require('./sql.util.js'),
    framework = require('framework');

var InfoMessageStrings = framework.InfoMessageStrings;
//SQLite语句构建工具
function SQLiteSQLBuilder() { }

//公布实例
module.exports = new SQLiteSQLBuilder();

//类型检测工具
SQLiteSQLBuilder.prototype.checkQues = framework.CheckQuestion;
//创建新增SQL语句
SQLiteSQLBuilder.prototype.buildInsertSQL = function (dataObject, tablename, allowFields) {
    var columns = [];
    var values = [];
    
    for (var column in dataObject) {
        if (this.supportColumn(dataObject, column, allowFields)) {
            columns.push(column);
            values.push(this.valueSQLRender(dataObject[column]));
        }
    }
    if (columns.length == 0) {
        framework.Log(InfoMessageStrings.sqliteNoTableOrFieldsString); return "";
    }
    return "INSERT INTO " + tablename + " (" + columns.join(",") + ") VALUES (" + values.join(",") + ");";
}
//创建修改语句
SQLiteSQLBuilder.prototype.buildSQLUpdateSQL = function (dataObject, tablename, allowFields, options) {
    var self = this;
    var values = this.buildFieldValues(dataObject, allowFields);
    var where = this.buildWheres(options);
    return "UPDATE " + tablename + " SET " + values + where + ";";
}
//创建删除语句
SQLiteSQLBuilder.prototype.buildDeleteSQL = function (tablename, options) {
    return "DELETE FROM " + tablename + this.buildWheres(options) + ";";
}
//创建查询语句
SQLiteSQLBuilder.prototype.buildSelectSQL = function (tablename, options) {
    options = options || {};
    var checkQues = this.checkQues;
    var where = this.buildWheres(options);
    var fields = options.fields;
    var limit = options.limit;
    var offset = options.offset;
    
    var _sql_fields = checkQues.isArray(fields) ? ("`" + fields.join("`,`") + "`") : "*";
    var _sql_limit = (limit && parseInt(limit) > 0) ? " LIMIT " + parseInt(limit) : "";
    var _sql_offset = (offset && parseInt(offset) > 0) ? " OFFSET " + parseInt(offset) : "";
    
    return "SELECT " + _sql_fields + " FROM " + tablename + where + _sql_limit + _sql_offset + ";";
}
//创建 Where 从句 options:{where:[["id",">",1]," id=1 "]}
SQLiteSQLBuilder.prototype.buildWheres = function (options) {
    options = options || {};
    var sqlSegments = [];
    var checkQues = this.checkQues;
    var where = options.where;
    if (checkQues.isArray(where) && where.length > 0) {
        sqlSegments.push(" WHERE");
        where.map(function (value) {
            if (checkQues.isArray(value)) {
                if (value.length === 3) {
                    sqlSegments.push(" `" + value[0] + "` " + value[1] + " '" + value[2] + "'");
                }
            } else {
                sqlSegments.push(" " + value + " ");
            }
        });
    }
    return sqlSegments.join('');
}
//创建SQL字段赋值语句
SQLiteSQLBuilder.prototype.buildFieldValues = function (dataObject, allowFields) {
    var sqlSegs = [];
    var fields = allowFields;
    var escape = sqlstrutil.escape;
    for (var key in dataObject) {
        if (this.supportColumn(dataObject, key, allowFields)) {
            sqlSegs.push("`" + key + "` = " + this.escape(dataObject[key]));
        }
    }
    return sqlSegs.join(",");
}
//检验指定列是否合法
SQLiteSQLBuilder.prototype.supportColumn = function (dataObject, field, allowFields) {
    if (!dataObject.hasOwnProperty(field)) {
        return false;
    }
    else if (allowFields.indexOf(field) === -1) {
        framework.Log(field + InfoMessageStrings.sqliteIngoreFieldsString);
        return false;
    } else {
        return true;
    }
}
//根据不同值类型返回对应的SQL字符串表示形式
SQLiteSQLBuilder.prototype.valueSQLRender = function (v) {
    if (this.checkQues.isNumber(v)) {
        return v;
    } else {
        return "'" + v + "'";
    }
}
//SQL值编码
SQLiteSQLBuilder.prototype.escape = function (v) {
    return sqlstrutil.escape(v);
}
//返回指定对象的keys
SQLiteSQLBuilder.prototype.keys = function (obj) {
    if (Object.keys) {
        return Object.keys(obj);
    } else {
        var keys = [];
        for (var key in obj) {
            keys.push(key);
        }
        return keys;
    }
}