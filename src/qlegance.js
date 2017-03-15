'use strict';

const QL = (()=>{
  const single = domSelection;

  // Holds an apps components defined by 'ql' attributes
  const Client = {
    components: [],
    server: null,
    types: {},
    cache: {}
  };

  single.getServer = () => { return Client.server; };

  single.setServer = (serv) => {
    if(typeof serv !== 'string' || serv === '') throw new Error('Incorrect input for server');
    Client.server = serv;
    return serv;
  };

  single.query = (string) => {
    return sendQuery("query" + string);
  };

  single.mutate = (string) => {
    return sendQuery("mutation" + string);
  };

  single.initializer = (serv) => {
    let server;
    if (typeof serv === 'undefined') {
      serv = document.querySelector('[ql-server]');
      if(!serv) throw new Error('GraphQL server has not been set.');
      server = serv.getAttribute('ql-server');
    } else {
      server = serv;
    }
    single.setServer(server);
    introspect();
    buildComponents();
  };

  return single;

  function domSelection(selection){
    //FIXME This feature is requested
    /* selection can be called QLegance('#users(2)') to make list selections
    */

    //Check if selection is a wrapper object
    if(selection.mutate !== undefined && selection.query !== undefined && selection.element !== undefined){
      return selection;
    }

    //Check if selection is unacceptable - neither node or string value
    if((selection.nodeType === undefined && selection.nodeName === undefined) && typeof selection !== 'string'){
      throw new Error('Unacceptable input value.');
    }

    // If selection is string perform a DOM query
    if(typeof selection === 'string'){
      selection = document.querySelectorAll(selection);

      //No returned elements to wrap
      if(selection.length === 0) return selection;
    }

    return wrapElement(selection);
  }

  function wrapElement(selection){
    let len = selection.length;
    let wrapper = [];

    for(let i = 0; i < len; i++){
      wrapper[i] = {element: selection[i]};

      wrapper[i].mutate = (method, args, returnValues) => {
        if(!single[method]) throw new Error("Field method doesn't exist.");
        return single[method](args, returnValues).then((result) => {
            let component = Client.components.find( component => { return selection[i] === component.element; });
            populate(component, result.data);
            resolve(result.data);
          });
      };

      wrapper[i].query = (method, args, returnValues, options) => {
        if (typeof options === 'undefined') options = {};
        return single[method](args, returnValues, options).then((result) => {
          let component = Client.components.find( component => { return selection[i] === component.element; });
          populate(component, result.data);
          return result.data;
        });
      };
  }
    return wrapper.length > 1 ? wrapper : wrapper[0];
  }

  function buildComponents(elements, nested){
    elements = elements || document.querySelectorAll('[ql-type], [ql-list]');
    if(elements.length === 0) return;

    elements = Array.prototype.slice.call(elements, 0); //convert NodeList to array

    for(let i = 0; i < elements.length; i++){
      let field, fields, typeName, method, component, nestedTypes, nestedFields;
      component = {element: elements[i]};

      nestedTypes = component.element.querySelectorAll('[ql-type], [ql-list]');
      console.log('nestedTypes:',nestedTypes);
      component.fields = [];
      fields = component.element.querySelectorAll('[ql-field]');
      console.log('fields:', fields);
      component.partial = component.element.cloneNode(true);

      if(nestedTypes.length > 0){
        nestedTypes = Array.prototype.slice.call(nestedTypes, 0);

        elements = elements.filter((element) => {
          return nestedTypes.reduce((unique, el) => {
            return unique && el !== element;
          }, true);
        });
        component.fields.push( buildComponents(nestedTypes, true) ); //passing true for nested value
      }

      if(!nested){
        [typeName, method] = getAttr(component.element).split('|');
        if(!typeName || !method) throw new Error('Field ql-type or ql-list is not defined correctly.');
        component.type_name = typeName.trim(); // ie. a schema defined for User
        component.initial_query = method.trim(); // ie. getUser(username: "Judy")
      }else{
        component.type_name = getAttr(component.element);
      }

      for(let n = 0; n < fields.length; n++){
        component.fields.push({name: getAttr(fields[n]), element: fields[n]});
      }

      if(component.fields.length > 0 && !nested){
        sendQuery(buildQuery(component)).then((result) =>{
          populate(component, result.data);
        });
      }

      Client.components.push(component);

      if(nested) return component;
    }
  }

  function getAttr(element){
    return element.getAttribute('ql-type') || element.getAttribute('ql-list') || element.getAttribute('ql-field');
  }

  function parseQueryFields(fields){
    return fields.map((field) => {
      if(field.type_name) return `${field.type_name} { ${parseQueryFields(field.fields)} }`;
      return field.name;
    }).join('\n');
  }

  function buildQuery(component){
    let query = component.initial_query;
    let fields = parseQueryFields(component.fields);

    if(query[query.length - 1] === ')' && query[query.length - 2] === '('){
      query = getMethodName(query);
    }

    return `{
      ${query}{
        ${fields}
      }
    }`;
  }

  function getMethodName(query){
    let index = query.indexOf('(');
    index = index || undefined;
    return query.substring(0, index);
  }

  function sendQuery(query){
    return new Promise((resolve, reject) => {
      console.log('QUERY:', query);
      let xhr = new XMLHttpRequest();

      xhr.open("POST", Client.server, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify({query}));

      xhr.onreadystatechange = () => {
        if(xhr.readyState === 4){
          if(xhr.status === 200){
            resolve(JSON.parse(xhr.response));
          }else{
            reject(new Error(xhr.status));
          }
        }
      };
    });
  }

  function populate(component, data){
    let input, template, len, element, value, keys,
      html = '';

    //FIXME Will need to iterate over keys when multiple queries are allowed
    let queryKey = Object.keys(data)[0]
    data = data[queryKey];

    data = Array.isArray(data) ? data : [data]; //Ensuring a length is available
    len = data.length;

    for(let i = 0; i < len; i++){
      template = component.partial.cloneNode(true);
      keys = Object.keys(data[i]);
      keys.forEach((key) => {
        element = template.querySelector(`[ql-field=${key}]`);
        if(!element){
          element = template.querySelector(`[ql-type=${key}]`) || template.querySelector(`[ql-list=${key}]`);
          let comp = Client.components.find((component) => { return getAttr(component.element) === getAttr(element); });
          let obj = {};
          obj[`${queryKey}`] = data[i][getAttr(element)];

          //populate an inner component then append it
          element.parentNode.replaceChild( populate(comp, obj), element);
        } else if (element.nodeName.toLowerCase() === 'input'){
          element.setAttribute('value', data[i][key]);
        } else {
          element.innerHTML = data[i][key];
        }
      });

      html += template.innerHTML;
    }

    component.element.innerHTML = html;
    return template;
  }

  function introspect() {
    const introspectiveQuery = `
      {
        __schema {
          mutationType {
            ...typeInfo
          }
          queryType {
            ...typeInfo
          }
          types {
            kind
            ...typeInfo
          }
        }
      }
      fragment typeInfo on __Type {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
              ofType {
                name
                kind
                ofType {
                  name
                  kind
                  ofType {
                    name
                    kind
                    ofType {
                      name
                      kind
                      description
                    }
                  }
                }
              }
            }
          }
          args {
            name
            defaultValue
            type {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                        ofType {
                        kind
                        name
                        ofType {
                          kind
                          name
                          description
                        }
                      }
                    }
                  } 
                }
              }
            }
          }
        }
      }
    `;
    sendQuery(introspectiveQuery)
      .then((res) => {
        const data = res.data.__schema;
        const fields = [];
        if (data.mutationType) {
          for (let i = 0; i < data.mutationType.fields.length; i += 1) {
            data.mutationType.fields[i].query = 'mutation';
            fields.push(data.mutationType.fields[i]);
          }
        }
        if (data.queryType) {
          for (let i = 0; i < data.queryType.fields.length; i += 1) {
            data.queryType.fields[i].query = 'query';
            fields.push(data.queryType.fields[i]);
          }
        }
        for (let i = 0; i < fields.length; i += 1) {
          typeConstructor(fields[i]);
          methodConstructor(fields[i]);
        }
        for (let i = 0; i < data.types.length; i += 1) {
          cacheTypesConstructor(data.types[i]);
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
    const fieldName = field.name;
    let current = field.type;
    let temp;
    while (current.ofType) {
      temp = current;
      current = current.ofType;
    }
    const type = current.name;
    let kind;
    if (temp) kind = temp.kind;
    else kind = current.kind;
    Client.types[fieldName] = {
      type : type,
      kind : kind
    };
  }

  function methodConstructor(field) {
    single[field.name] = function(obj, arr, options) {
      if (typeof options === 'undefined') options = {};
      const requiredArgs = field.args;
      const args = argsConstructor(obj, requiredArgs);
      const returnValues = returnValsConstructor(arr);
      const queryStr = `
        ${field.query} {
          ${field.name}${args} {
            ${returnValues}
          }
        }
      `;
      if (options.cache) {
        return queryCache(field.query, field.name, obj, arr, args, returnValues);
      } else {
        return sendQuery(queryStr);
      }
    }
  }

  function queryCache(query, fieldName, args, returnValues, argStr, returnValStr) {
    const queryStr = `
      ${query} {
        ${fieldName}${argStr} {
          ${returnValStr}
        }
      }
    `;
    const cacheType = Client.types[fieldName].type;
    const cacheKind = Client.types[fieldName].kind;
    if (cacheKind === 'OBJECT') {
      for (let i = 0; i < Client.cache[cacheType].length; i += 1) {
        let argMatch = true;
        let rvMatch = true;
        for (let key in args) {
          if (!Client.cache[cacheType][i][key] || Client.cache[cacheType][i][key] !== args[key]) {
            argMatch = false;
          }
        }
        for (let j = 0; j < returnValues.length; j += 1) {
          let returnVal = returnValues[j];
          if (typeof returnValues[j] === 'object') {
            returnVal = Object.keys(returnValues[j])[0];
          }
          if (!Client.cache[cacheType][i][returnVal]) {
            rvMatch = false;
          }
        }
        if (argMatch && rvMatch) {
          return new Promise((resolve, reject) => {
            resolve({data : {fieldName : Client.cache[cacheType][i]}});
          });
        }
      }
      return cacher(queryStr, cacheType, fieldName);
    } else {
      return sendQuery(queryStr)
        .then((res) => {
          return new Promise((resolve, reject) => {
            resolve(res);
          });
        });
    }
  }

  function cacher(string, cacheType, fieldName, index) {
    return sendQuery(string)
      .then((res) => {
        const data = res.data[fieldName];
        if (index) Client.cache[cacheType].splice(index, 1);
        Client.cache[cacheType].push(data);
        return new Promise((resolve, reject) => {
          resolve(res);
        });
      });
  }

  function argsConstructor(obj, array) {
    if (!array.length) {
      return '';
    }
    let output = '';
    for (let i = 0; i < array.length; i += 1) {
      let end = ''; 
      if (i < array.length - 1) end += ', ';
      let current = array[i].type;
      while (current.ofType) {
        current = current.ofType;
      }
      if (array[i].name in obj) {
        const item = typeConverter(current.name, obj[array[i].name]);
        output += `${array[i].name} : ${item}${end}`;
      }
    }
    return `(${output})`;
  }

  function returnValsConstructor(array) {
    array.sort();
    let output = '';
    for (let i = 0; i < array.length; i += 1) {
      output += ' ';
      if (typeof array[i] === 'string') {
        output += array[i];
      } else {
        const key = Object.keys(array[i])[0];
        output += `${key} {${returnValsConstructor(array[i][key])} }`;
      }
    }
    return output;
  }

  function typeConverter(type, item) {
    if (type === 'String') {
      return `"${item}"`;
    }
    if (type === 'Int' || type === 'Float') {
      return Number(item);
    }
  }

})();