(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var QL = function () {
  var single = domSelection;

  // Holds an apps components defined by 'ql' attributes
  var Client = {
    components: [],
    server: null,
    types: {},
    cache: {}
  };

  single.getServer = function () {
    return Client.server;
  };

  single.setServer = function (serv) {
    if (typeof serv !== 'string' || serv === '') throw new Error('Incorrect input for server');
    Client.server = serv;
    return serv;
  };

  single.query = function (string) {
    return sendQuery("query" + string);
  };

  single.mutate = function (string) {
    return sendQuery("mutation" + string);
  };

  single.initializer = function (serv) {
    var server = void 0;
    if (typeof serv === 'undefined') {
      serv = document.querySelector('[ql-server]');
      if (!serv) throw new Error('GraphQL server has not been set.');
      server = serv.getAttribute('ql-server');
    } else {
      server = serv;
    }
    single.setServer(server);
    introspect();
    buildComponents();
  };

  return single;

  function domSelection(selection) {
    //FIXME This feature is requested
    /* selection can be called QLegance('#users(2)') to make list selections
    */

    //Check if selection is a wrapper object
    if (selection.mutate !== undefined && selection.query !== undefined && selection.element !== undefined) {
      return selection;
    }

    //Check if selection is unacceptable - neither node or string value
    if (selection.nodeType === undefined && selection.nodeName === undefined && typeof selection !== 'string') {
      throw new Error('Unacceptable input value.');
    }

    // If selection is string perform a DOM query
    if (typeof selection === 'string') {
      selection = document.querySelectorAll(selection);

      //No returned elements to wrap
      if (selection.length === 0) return selection;
    }

    return wrapElement(selection);
  }

  function wrapElement(selection) {
    var len = selection.length;
    var wrapper = [];

    var _loop = function _loop(i) {
      wrapper[i] = { element: selection[i] };

      //FIXME not  fully implemented
      wrapper[i].mutate = function (method, args, returnValues) {
        if (!single[method]) throw new Error("Field method doesn't exist.");
        return single[method](args, returnValues).then(function (result) {
          var component = Client.components.find(function (component) {
            return selection[i] === component.element;
          });
          populate(component, result.data);
          resolve(result.data);
        });
      };

      wrapper[i].query = function (method, args, returnValues, options) {
        if (typeof options === 'undefined') options = {};
        return single[method](args, returnValues, options).then(function (result) {
          var component = Client.components.find(function (component) {
            return selection[i] === component.element;
          });
          populate(component, result.data);
          return result.data;
        });
      };
    };

    for (var i = 0; i < len; i++) {
      _loop(i);
    }
    return wrapper.length > 1 ? wrapper : wrapper[0];
  }

  function buildComponents(elements, nested) {
    elements = elements || document.querySelectorAll('[ql-type], [ql-list]');
    if (elements.length === 0) return;

    elements = Array.prototype.slice.call(elements, 0); //convert NodeList to array

    var _loop2 = function _loop2(i) {
      var field = void 0,
          fields = void 0,
          typeName = void 0,
          method = void 0,
          component = void 0,
          nestedTypes = void 0,
          nestedFields = void 0;
      component = { element: elements[i] };

      nestedTypes = component.element.querySelectorAll('[ql-type], [ql-list]');

      component.fields = [];
      fields = component.element.querySelectorAll('[ql-field]');
      component.partial = component.element.cloneNode(true);

      if (nestedTypes.length > 0) {
        nestedTypes = Array.prototype.slice.call(nestedTypes, 0);

        elements = elements.filter(function (element) {
          return nestedTypes.reduce(function (unique, el) {
            return unique && el !== element;
          }, true);
        });
        component.fields.push(buildComponents(nestedTypes, true)); //passing true for nested value
      }

      if (!nested) {
        var _getAttr$split = getAttr(component.element).split('|');

        var _getAttr$split2 = _slicedToArray(_getAttr$split, 2);

        typeName = _getAttr$split2[0];
        method = _getAttr$split2[1];

        if (!typeName || !method) throw new Error('Field ql-type or ql-list is not defined correctly.');
        component.type_name = typeName.trim(); // ie. a schema defined for User
        component.initial_query = method.trim(); // ie. getUser(username: "Judy")
      } else {
        component.type_name = getAttr(component.element);
      }

      for (var n = 0; n < fields.length; n++) {
        component.fields.push({ name: getAttr(fields[n]), element: fields[n] });
      }

      if (component.fields.length > 0 && !nested) {
        sendQuery(buildQuery(component)).then(function (result) {
          populate(component, result.data);
        });
      }

      Client.components.push(component);

      if (nested) return {
          v: component
        };
    };

    for (var i = 0; i < elements.length; i++) {
      var _ret2 = _loop2(i);

      if ((typeof _ret2 === 'undefined' ? 'undefined' : _typeof(_ret2)) === "object") return _ret2.v;
    }
  }

  function getAttr(element) {
    return element.getAttribute('ql-type') || element.getAttribute('ql-list') || element.getAttribute('ql-field');
  }

  function parseQueryFields(fields) {
    return fields.map(function (field) {
      if (field.type_name) return field.type_name + ' { ' + parseQueryFields(field.fields) + ' }';
      return field.name;
    }).join('\n');
  }

  function buildQuery(component) {
    var query = component.initial_query;
    var fields = parseQueryFields(component.fields);

    if (query[query.length - 1] === ')' && query[query.length - 2] === '(') {
      query = getMethodName(query);
    }

    return '{\n      ' + query + '{\n        ' + fields + '\n      }\n    }';
  }

  function getMethodName(query) {
    var index = query.indexOf('(');
    index = index || undefined;
    return query.substring(0, index);
  }

  function sendQuery(query) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();

      xhr.open("POST", Client.server, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify({ query: query }));

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.response));
          } else {
            reject(new Error(xhr.status));
          }
        }
      };
    });
  }

  function populate(component, data) {
    var input = void 0,
        template = void 0,
        len = void 0,
        element = void 0,
        value = void 0,
        keys = void 0,
        html = '';

    //FIXME Will need to iterate over keys when multiple queries are allowed
    var queryKey = Object.keys(data)[0];
    data = data[queryKey];

    data = Array.isArray(data) ? data : [data]; //Ensuring a length is available
    len = data.length;

    var _loop3 = function _loop3(i) {
      template = component.partial.cloneNode(true);
      keys = Object.keys(data[i]);
      keys.forEach(function (key) {
        element = template.querySelector('[ql-field=' + key + ']');
        if (!element) {
          element = template.querySelector('[ql-type=' + key + ']') || template.querySelector('[ql-list=' + key + ']');
          var comp = Client.components.find(function (component) {
            return getAttr(component.element) === getAttr(element);
          });
          var obj = {};
          obj['' + queryKey] = data[i][getAttr(element)];

          //populate an inner component then append it
          element.parentNode.replaceChild(populate(comp, obj), element);
        } else if (element.nodeName.toLowerCase() === 'input') {
          element.setAttribute('value', data[i][key]);
        } else {
          element.innerHTML = data[i][key];
        }
      });

      html += template.innerHTML;
    };

    for (var i = 0; i < len; i++) {
      _loop3(i);
    }

    component.element.innerHTML = html;
    return template;
  }

  function introspect() {
    var introspectiveQuery = '\n      {\n        __schema {\n          mutationType {\n            ...typeInfo\n          }\n          queryType {\n            ...typeInfo\n          }\n          types {\n            kind\n            ...typeInfo\n          }\n        }\n      }\n      fragment typeInfo on __Type {\n        name\n        fields {\n          name\n          type {\n            name\n            kind\n            ofType {\n              name\n              kind\n              ofType {\n                name\n                kind\n                ofType {\n                  name\n                  kind\n                  ofType {\n                    name\n                    kind\n                    ofType {\n                      name\n                      kind\n                      description\n                    }\n                  }\n                }\n              }\n            }\n          }\n          args {\n            name\n            defaultValue\n            type {\n              kind\n              name\n              ofType {\n                kind\n                name\n                ofType {\n                  kind\n                  name\n                  ofType {\n                    kind\n                    name\n                    ofType {\n                      kind\n                      name\n                        ofType {\n                        kind\n                        name\n                        ofType {\n                          kind\n                          name\n                          description\n                        }\n                      }\n                    }\n                  } \n                }\n              }\n            }\n          }\n        }\n      }\n    ';
    sendQuery(introspectiveQuery).then(function (res) {
      var data = res.data.__schema;
      var fields = [];
      for (var i = 0; i < data.mutationType.fields.length; i += 1) {
        data.mutationType.fields[i].query = 'mutation';
        fields.push(data.mutationType.fields[i]);
      }
      for (var _i = 0; _i < data.queryType.fields.length; _i += 1) {
        data.queryType.fields[_i].query = 'query';
        fields.push(data.queryType.fields[_i]);
      }
      for (var _i2 = 0; _i2 < fields.length; _i2 += 1) {
        typeConstructor(fields[_i2]);
        methodConstructor(fields[_i2]);
      }
      for (var _i3 = 0; _i3 < data.types.length; _i3 += 1) {
        cacheTypesConstructor(data.types[_i3]);
      }
    });
  }

  function cacheTypesConstructor(type) {
    if (!Client.types[type.name] && type.kind === 'OBJECT' && type.name[0] !== '_') {
      if (!Client.types[type.fields[0].name]) {
        Client.cache[type.name] = [];
      }
    }
  }

  function typeConstructor(field) {
    var fieldName = field.name;
    var current = field.type;
    var temp = void 0;
    while (current.ofType) {
      temp = current;
      current = current.ofType;
    }
    var type = current.name;
    var kind = void 0;
    if (temp) kind = temp.kind;else kind = current.kind;
    Client.types[fieldName] = {
      type: type,
      kind: kind
    };
  }

  function methodConstructor(field) {
    single[field.name] = function (obj, arr, options) {
      if (typeof options === 'undefined') options = {};
      var requiredArgs = field.args;
      var args = argsConstructor(obj, requiredArgs);
      var returnValues = returnValsConstructor(arr);
      var queryStr = '\n        ' + field.query + ' {\n          ' + field.name + args + ' {\n            ' + returnValues + '\n          }\n        }\n      ';
      if (options.cache) {
        return queryCache(field.query, field.name, obj, arr, args, returnValues);
      } else {
        return sendQuery(queryStr);
      }
    };
  }

  function queryCache(query, fieldName, args, returnValues, argStr, returnValStr) {
    var queryStr = '\n      ' + query + ' {\n        ' + fieldName + argStr + ' {\n          ' + returnValStr + '\n        }\n      }\n    ';
    var cacheType = Client.types[fieldName].type;
    var cacheKind = Client.types[fieldName].kind;
    if (cacheKind === 'OBJECT') {
      var _loop4 = function _loop4(i) {
        var argMatch = true;
        var rvMatch = true;
        for (var key in args) {
          if (!Client.cache[cacheType][i][key] || Client.cache[cacheType][i][key] !== args[key]) {
            argMatch = false;
          }
        }
        for (var j = 0; j < returnValues.length; j += 1) {
          var returnVal = returnValues[j];
          if (_typeof(returnValues[j]) === 'object') {
            returnVal = Object.keys(returnValues[j])[0];
          }
          if (!Client.cache[cacheType][i][returnVal]) {
            rvMatch = false;
          }
        }
        if (argMatch && rvMatch) {
          return {
            v: new Promise(function (resolve, reject) {
              resolve({ data: { fieldName: Client.cache[cacheType][i] } });
            })
          };
        }
      };

      for (var i = 0; i < Client.cache[cacheType].length; i += 1) {
        var _ret4 = _loop4(i);

        if ((typeof _ret4 === 'undefined' ? 'undefined' : _typeof(_ret4)) === "object") return _ret4.v;
      }
      return cacher(queryStr, cacheType, fieldName);
    } else {
      return sendQuery(queryStr).then(function (res) {
        return new Promise(function (resolve, reject) {
          resolve(res);
        });
      });
    }
  }

  function cacher(string, cacheType, fieldName, index) {
    return sendQuery(string).then(function (res) {
      var data = res.data[fieldName];
      if (index) Client.cache[cacheType].splice(index, 1);
      Client.cache[cacheType].push(data);
      return new Promise(function (resolve, reject) {
        resolve(res);
      });
    });
  }

  function argsConstructor(obj, array) {
    if (!array.length) {
      return '';
    }
    var output = '';
    for (var i = 0; i < array.length; i += 1) {
      var end = '';
      if (i < array.length - 1) end += ', ';
      var current = array[i].type;
      while (current.ofType) {
        current = current.ofType;
      }
      if (array[i].name in obj) {
        var item = typeConverter(current.name, obj[array[i].name]);
        output += array[i].name + ' : ' + item + end;
      }
    }
    return '(' + output + ')';
  }

  function returnValsConstructor(array) {
    array.sort();
    var output = '';
    for (var i = 0; i < array.length; i += 1) {
      output += ' ';
      if (typeof array[i] === 'string') {
        output += array[i];
      } else {
        var key = Object.keys(array[i])[0];
        output += key + ' {' + returnValsConstructor(array[i][key]) + ' }';
      }
    }
    return output;
  }

  function typeConverter(type, item) {
    if (type === 'String') {
      return '"' + item + '"';
    }
    if (type === 'Int' || type === 'Float') {
      return Number(item);
    }
  }
}();

},{}]},{},[1]);