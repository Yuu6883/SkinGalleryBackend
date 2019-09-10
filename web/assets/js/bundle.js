(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],2:[function(require,module,exports){
const { EventEmitter } = require("events");

/** @typedef {{ username: String, discriminator: String, avatar: String, id: String }} UserInfo */
/** @type {import("jquery")} */
const $ = window.$;

module.exports = new class API extends EventEmitter {

    constructor() {
        super();
        this.jwt = "";
        /** @type {UserInfo} */
        this.userInfo = null;
    }

    init() {

        this.on("loginSuccess", () => localStorage.autoLogin = "ha")
            .on("loginFail", () => delete localStorage.autoLogin)
            .on("logoutSuccess", () => delete localStorage.autoLogin)
            .on("logoutFail", () => delete localStorage.autoLogin);

        if (localStorage.autoLogin) this.login();
        else this.emit("needToLogin");
    }

    redirectLogin() {
        localStorage.autoLogin = "ha";
        window.location.replace(window.location.href.match(/^https?:\/\/.+\//)[0] + "api/login");
    }

    login() {
        $.post({
            url: "/api/login",
            dataType: "json",
            success: res => {
                this.userInfo = res;
                this.emit("loginSuccess");
            },
            error: () => {
                this.emit("loginFail");
            }
        });
    }

    get fullName() {
        return this.userInfo.username + "#" + this.userInfo.discriminator;
    }

    get avatarURL() {
        return `https://cdn.discordapp.com/avatars/${this.userInfo.id}/${this.userInfo.avatar}.png`;
    }

    logout() {
        $.post({
            url: "/api/logout",
            success: () => {
                this.emit("logoutSuccess");
            },
            error: () => {
                this.emit("logoutFail");
            }
        });
    }

    uploadSkin(name, data) {
        $.post({
            url: "/api/skins/" + encodeURIComponent(name),
            data,
            /** @param {{status:SkinStatus}} res */
            success: res => {
                this.emit("skinUploaded", res);
            },
            error: e => {
                console.error(e);
            }
        });
    }

    listSkin(owner = "@me") {
        $.get({
            url: "/api/skins/" + owner,
            dataType: "json",
            success: res => {
                if (owner === "@me") {
                    this.emit("myskin", res);
                }
            },
            error: console.error
        });
    }

    editSkinName(skinID, newName) {
        $.ajax({
            method: "PUT",
            url: `/api/skins/${skinID}?name=${encodeURIComponent(newName)}`,
            dataType: "json",
            success: res => {
                if (res.success) this.emit("skinEditSuccess", newName);
            },
            error: console.error
        });
    }

    deleteSkin(skinID, name) {
        $.ajax({
            method: "DELETE",
            url: `/api/skins/${skinID}`,
            dataType: "json",
            success: res => {
                if (res.success) this.emit("skinDeleteSuccess", name);
            },
            error: console.error
        });
    }
}

},{"events":1}],3:[function(require,module,exports){


/** @type {import("jquery")} */
const $ = window.$;

const API = require("./api");
const Prompt = require("./prompt");
const Starfield = require("./starfield");

const emptySkinPanel = 
`<div class="uk-width-1-5@l uk-width-1-2@m uk-card uk-margin-top">
    <div class="padding-s uk-inline-clip uk-transition-toggle uk-text-center card">
        <img src="assets/img/logo-grey.png" class="skin-preview skin-empty">
        <div class="uk-position-center">
            <span class="text uk-transition-fade pointer skin-upload" uk-icon="icon:cloud-upload;ratio:2" uk-tooltip="Upload skin"></span>
        </div>
    </div>
</div>`;

const escapeHtml = unsafe => unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");

/** @param {{skinID:string,skinName:string,status:SkinStatus}} skinObject */
const linkedSkinPanel = skinObject => {

    let link = skinObject.status === "approved" ? `/s/${skinObject.skinID}` : `/api/p/skin/${skinObject.skinID}`;
    let labelClass = { "approved": "success", "pending": "warning", "rejected": "danger" }[skinObject.status];
    return "" +
    `<div class="uk-width-1-5@l uk-width-1-2@m uk-card uk-margin-top">
        <div class="padding-s uk-inline-clip pointer uk-text-center uk-transition-toggle card">
            <div>
                <a href="${link}" data-type="image" data-caption="<h1 class='text uk-margin-large-bottom'>${escapeHtml(skinObject.skinName)}</h1>">
                    <img src="${link}" class="skin-preview uk-transition-scale-up uk-transition-opaque">
                </a>
            </div>
            <div class="top-right uk-label uk-label-${labelClass} uk-transition-slide-top">${skinObject.status}</div>
            <h3 class="text uk-position-bottom-center uk-margin-small-bottom">${escapeHtml(skinObject.skinName)}</h3>
            <div class="bottom-right">
                ${skinObject.status === "approved" ? `<span uk-icon="icon:link;ratio:1.5"      class="text uk-transition-slide-bottom skin-link"
                link="${window.location.origin}${link}" uk-tooltip="Copy skin URL"></span><br>` : ""}
                <span uk-icon="icon:file-edit;ratio:1.5" class="text uk-transition-slide-bottom skin-edit"
                        skin-id="${skinObject.skinID}" skin-name="${skinObject.skinName}" uk-tooltip="Edit this skin's name"></span><br>
                <span uk-icon="icon:trash;ratio:1.5"     class="text uk-transition-slide-bottom skin-delete"
                        skin-id="${skinObject.skinID}" skin-name="${skinObject.skinName}" uk-tooltip="Delete this skin"></span>
            </div>
        </div>
    </div>`
}

let copyEl;
$(window).on("load", () => {

    copyEl = document.getElementById("copy");

    new Starfield($("#starfield")[0]).start();

    // API.on("needToLogin", () => Prompt.login().then(() => API.redirectLogin()));
    $("#logout").click(() => API.logout());
    $("#login").click(() => API.redirectLogin());

    API.on("loginSuccess", () => {
        $("#login-panel").hide();
        $("#user-panel").show();
        $("#user-pfp").attr("src", API.avatarURL);
        $("#username").text(API.fullName);
        $("#skin-panel").show();

        API.listSkin();
    });

    API.on("logoutSuccess", () => {
        $("#login-panel").show();
        $("#user-panel").hide();
        $("#skin-panel").hide();
    });

    API.on("myskin", skins => updateSkinPanel(skins));

    API.on("skinUploaded", res => {
        if (res.error) return console.error(res.error);
        Prompt.skinResult(res).then(() => API.listSkin());
    });

    API.on("skinEditSuccess", newName => {
        Prompt.skinEditResult(escapeHtml(newName)).then(() => API.listSkin());
    });

    API.on("skinDeleteSuccess", name => {
        Prompt.skinDeleteResult(escapeHtml(name)).then(() => API.listSkin());
    });

    API.init();

    $(document).ajaxStart(() => Prompt.showLoader());
    $(document).ajaxComplete(() => Prompt.hideLoader());
});

const updateSkinPanel = skins => {
    let skinsHTML = skins.map(linkedSkinPanel).join("");
    let emptySkinsHTML = emptySkinPanel.repeat(10 - skins.length);            

    let panel = $("#skin-panel").children().first();
    panel.children().remove();
    panel.append($(skinsHTML + emptySkinsHTML));

    $(".skin-upload").click(() => Prompt.inputImage());

    $(".skin-edit").click(function() {
        Prompt.editSkinName($(this).attr("skin-id"), $(this).attr("skin-name"));
    });

    $(".skin-delete").click(function() {
        Prompt.deleteSkin($(this).attr("skin-id"), $(this).attr("skin-name"));
    });

    $(".skin-link").click(function() {

        $(copyEl).val($(this).attr("link"));
        $(copyEl).text($(this).attr("link"));
        
        if (copyText(copyEl))
            Prompt.copied($(copyEl).val());
        else
            Prompt.copyFail($(copyEl).val());
    });
}

const copyText = element => {
    let range, selection;
  
    if (document.body.createTextRange) {
        range = document.body.createTextRange();
        range.moveToElementText(element);
        range.select();
    } else if (window.getSelection) {
        selection = window.getSelection();        
        range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    try {
        document.execCommand('copy');
        return true;
    }
    catch (err) {
        return false;
    }
}
},{"./api":2,"./prompt":4,"./starfield":5}],4:[function(require,module,exports){
/** @type {import("sweetalert2").default} */
const Swal = window.Swal;
const API = require("./api");

/** 
 * @param {File} file 
 * @returns {Promise.<{name:String,img:HTMLImageElement}>}
 */
const readImage = file => new Promise(resolve => {
    let img = new Image();
    img.onload = () => resolve({ name: file.name, img });
    img.src = URL.createObjectURL(file);
});

module.exports = new class Prompt {
    
    constructor() {
        
        this.alert = Swal.mixin({
            background: '#172535',
            heightAuto: false,
            focusConfirm: false,
            focusCancel: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            customClass: {
                popup: "uk-width-1-2@l uk-width-2-3@m uk-width-4-5",
                title: "text",
                content: "text",
                confirmButton: "btn",
                cancelButton: "btn danger",
            }
        });

    }

    /** @param {string} text */
    showLoader(text) {

        return this.alert.fire({
            background: "transparent",
            showConfirmButton: false,
            showCancelButton: false,
            title: $(`<div class="lds-spinner">${"<div></div>".repeat(12)}<div>`),
            text: text || "",
            timer: 10000,
        });
    }

    hideLoader() {
        if ($(".lds-spinner").length) {
            this.alert.close();
        } 
    }

    inputImage() {
        this.alert.fire({
            title: "Upload Skin",
            html:   `<div class="uk-placeholder uk-margin-top uk-text-center upload-holder pointer uk-width-expand uk-vertical-align-middle upload-panel" uk-form-custom>
                        <span class="uk-text-middle text">Attach skin by dropping here <br> or click to select one </span>
                        <span class="text" uk-icon="icon: cloud-upload"></span>
                        <input class="pointer" type="file" accept="image/*" id="skin-input">
                    </div>`,
            showCancelButton: true,
            confirmButtonText: "Continue",
            input: "url",
            inputPlaceholder: "Or enter image URL here",
            onOpen: () => {
                let self = this;
                $("#skin-input").change(function() {
                    readImage(this.files.item(0)).then(skin => self.editSkin(skin));
                });
            }
        }).then(result => {
            if (result.dismiss) return;
            let url = result.value;

            if (url) {
                let img = new Image;
                img.crossOrigin = "anonymous";
                img.onload = () => this.editSkin({ name: url.split("/").slice(-1)[0], img });
                img.onabort = img.onerror = () => this.alert.fire("Invalid Skin URL", `Failed to load image from ${url}`, "error");
                img.src = url;
            }
        });
    }

    /** @param {{name:String,img:HTMLImageElement}} skin */
    editSkin(skin) {
        let canvas = document.createElement("canvas");
        canvas.width = canvas.height = 512;
        $(canvas).addClass("skin-preview");

        let ctx = canvas.getContext("2d");
        ctx.arc(256, 256, 256, 256, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(skin.img, 0, 0, 512, 512);

        let extraMessage = "";
        if (skin.img.width != 512 || skin.img.height != 512) 
            extraMessage = `Warning: Your image dimension is ${skin.img.width}x${skin.img.height}.` + 
                           ` 512x512 skin recommended. Other size will be force scaled.`

        this.alert.fire({
            title: "Preview",
            text: extraMessage,
            input: "text",
            inputClass: "text",
            inputAttributes: {
                maxLength: 16
            },
            inputAutoTrim: true,
            confirmButtonText: "Submit",
            showCancelButton: true,
            inputValue: skin.name.split(".").slice(0, -1).join("."),
            onOpen: () => {
                $(this.alert.getContent()).prepend(canvas);
            }
        }).then(result => {
            if (result.dismiss) return;
            API.uploadSkin($(this.alert.getInput()).val(), canvas.toDataURL("image/jpeg", 1));
        });
    }

    /** @param {{status:SkinStatus}} res */
    skinResult(res) {
        switch (res.status) {
            case "approved":
                return this.alert.fire("Skin Approved", "Be aware that if this skin actually contains NSFW it will still be banned.", "success");

            case "pending":
                return this.alert.fire("Skin Pending", "Your skin will need to be manually reviewed because" + 
                    " it might contain NSFW content.", "warning");

            case "rejected":
                return this.alert.fire("Skin Rejected", "Your skin most likely contains NSFW content, which is not allowed.");

            default:
                console.error(`Unknown status: ${res.status}`);

        }
    }

    skinEditResult(newName) {
        return this.alert.fire("Success", `Skin name changed to ${newName}`, "success");
    }

    skinDeleteResult(skinName) {
        return this.alert.fire("Success", `Skin ${skinName} deleted`, "success");
    }

    editSkinName(skinID, oldName) {
        this.alert.fire({
            title: "Edit Skin Name",
            input: "text",
            inputAttributes: {
                maxLength: 16
            },
            inputAutoTrim: true,
            confirmButtonText: "Save",
            showCancelButton: true,
            inputValue: oldName
        }).then(result => {
            if (result.dismiss) return;
            if (result.value == oldName) return;
            API.editSkinName(skinID, result.value);
        });
    }
    
    deleteSkin(skinID, name) {
        this.alert.fire({
            title: `Delete Skin`,
            type: "warning",
            text: `You are about to delete skin ${name}`,
            confirmButtonClass: "btn danger",
            confirmButtonText: "Delete",
            showCancelButton: true
        }).then(result => {
            if (result.dismiss) return;
            API.deleteSkin(skinID, name);
        });
    }

    copied(url) {
        this.alert.fire({
            allowOutsideClick: true,
            showConfirmButton: false,
            timer: 2000,
            type: "success",
            title: "Linked Copied to Clipboard",
            text: url
        });
    }

    copyFail(url) {
        this.alert.fire({
            allowOutsideClick: true,
            title: "Failed to Copy to Clipboard",
            text: "You can copy the link manually",
            inputValue: url,
            type: "error"
        });
    }
}
},{"./api":2}],5:[function(require,module,exports){
/** @typedef {{ x: Number, y: Number }} Vector */

class Starfield {

    /** 
     * @param {HTMLCanvasElement} canvas 
     * @param {Object} options
     * @param {Number} [options.starNumber]
     * @param {Number} [options.startRadius]
     * @param {Number} [options.radiusIncrease]
     * @param {Number} [options.speedBase]
     * @param {Number} [options.speedRange]
     * @param {Number} [options.enterTime] enter phase time in seconds
     * @param {String} [options.color]
     * @param {Number} [options.alpha]
     */
    constructor (canvas, options) {

        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        /** @type {Star[]} */
        this.stars = [];

        this.config = {
            starNumber: 220,
            startRadius: .1,
            radiusIncrease: .0035,
            speedBase: .4,
            speedRange: 3.3,
            enterTime: 0.55,
            color: "#00b8ff",
            alpha: .9
        };

        Object.assign(this.config, options);

        this.resize();
        this.init();
    }

    init() {
        window.addEventListener("resize", () => this.resize());
    }

    start() {
        this.stars = Array.from({ length: this.config.starNumber })
                          .map(() => new Star(this, this.randomVector));

        this.startTime = 0;
        this.lastUpdate = 0;

        this.stopped = false;
        this.render();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    stop() {
        this.stopped = true;
    }

    render() {

        if (this.stopped) return;
        let now = window.performance && window.performance.now ? window.performance.now() : Date.now();

        if (!this.startTime) {
            this.startTime = this.lastUpdate = now;
        }

        let dt = (now - this.lastUpdate) / 6;

        let enterPhase = now - this.startTime - 1e3 * this.config.enterTime;

        if (enterPhase > 0) {
            let d = enterPhase / 1e3;

            if (d > 1.2) d = 1.2;

            dt /= Math.pow(3, d);
        }

        this.ctx.save();
        this.clear();
        this.ctx.translate(this.hwidth, this.hheight);
        this.update(dt);
        this.ctx.restore();

        requestAnimationFrame(timestamp => this.render(timestamp));
        this.lastUpdate = now;
    }

    /** @param {Number} */
    update(dt) {
        let ctx = this.ctx;

        ctx.beginPath();
        ctx.fillStyle = this.config.color;
        ctx.globalAlpha = this.config.alpha;
        this.stars.forEach(star => star.draw(dt));
        ctx.fill();

    } 

    resize() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
        this.hwidth = this.width / 2;
        this.hheight = this.height / 2;
    }

    get randomVector() {
        return {
            x: Math.random() * this.width * 2 - this.width,
            y: Math.random() * this.height * 2 - this.height
        }
    }
}

class Star {

    /** 
     * @param {Starfield} field
     * @param {Vector} initVector
     */
    constructor(field, initVector) {

        this.field = field;
        this.spawn(initVector);
    }

    /** @param {Vector} */
    spawn(vector) {

        this.x = vector.x;
        this.y = vector.y;
        this.angle = Math.atan2(this.y, this.x);
        this.radius = this.field.config.startRadius;
        this.speed = this.field.config.speedBase + this.field.config.speedRange * Math.random();
    }

    /** @param {Number} dt delta time */
    update(dt) {

        let dist = this.speed * dt;
        this.x += Math.cos(this.angle) * dist;
        this.y += Math.sin(this.angle) * dist;
        this.radius += this.field.config.radiusIncrease * dist;
    }

    /** @param {Number} dt delta time */
    draw(dt) {

        this.update(dt);

        if (this.isOutside) this.spawn(this.field.randomVector);

        this.field.ctx.moveTo(this.x, this.y);
        this.field.ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
    }

    get isOutside() {

        let xBound = this.field.hwidth + this.radius;
        let yBound = this.field.hheight + this.radius;

        return this.x < - xBound || this.x > xBound || this.y < - yBound || this.y > yBound;
    }
}

module.exports = Starfield;
},{}]},{},[3]);
