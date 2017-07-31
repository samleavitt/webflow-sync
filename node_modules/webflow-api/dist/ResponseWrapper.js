"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ResponseWrapper = function () {
  function ResponseWrapper(api) {
    _classCallCheck(this, ResponseWrapper);

    this.api = api;
  }

  _createClass(ResponseWrapper, [{
    key: "site",
    value: function site(_site) {
      return _extends({}, _site, {

        collections: this.api.collections.bind(this.api, { siteId: _site._id }),
        webhooks: this.api.webhooks.bind(this.api, { siteId: _site._id }),
        domains: this.api.domains.bind(this.api, { siteId: _site._id }),
        webhook: function webhook(first) {
          var _api;

          for (var _len = arguments.length, rest = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
            rest[_key - 1] = arguments[_key];
          }

          return (_api = this.api).webhook.apply(_api, [_extends({}, first, { siteId: _site._id })].concat(rest));
        },
        createWebhook: function createWebhook(first) {
          var _api2;

          for (var _len2 = arguments.length, rest = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
            rest[_key2 - 1] = arguments[_key2];
          }

          return (_api2 = this.api).createWebhook.apply(_api2, [_extends({}, first, { siteId: _site._id })].concat(rest));
        },
        removeWebhook: function removeWebhook(first) {
          var _api3;

          for (var _len3 = arguments.length, rest = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
            rest[_key3 - 1] = arguments[_key3];
          }

          return (_api3 = this.api).removeWebhook.apply(_api3, [_extends({}, first, { siteId: _site._id })].concat(rest));
        },
        publishSite: function publishSite(domains) {
          return this.api.publishSite({ siteId: _site._id, domains: domains });
        }
      });
    }
  }, {
    key: "domain",
    value: function domain(_domain) {
      return _extends({}, _domain);
    }
  }, {
    key: "collection",
    value: function collection(_collection) {
      return _extends({}, _collection, {

        items: this.api.items.bind(this.api, { collectionId: _collection._id }),
        item: function item(first) {
          var _api4;

          for (var _len4 = arguments.length, rest = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
            rest[_key4 - 1] = arguments[_key4];
          }

          return (_api4 = this.api).item.apply(_api4, [_extends({}, first, { collectionId: _collection._id })].concat(rest));
        },
        createItem: function createItem(first) {
          var _api5;

          for (var _len5 = arguments.length, rest = Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
            rest[_key5 - 1] = arguments[_key5];
          }

          return (_api5 = this.api).createItem.apply(_api5, [_extends({}, first, { collectionId: _collection._id })].concat(rest));
        },
        updateItem: function updateItem(first) {
          var _api6;

          for (var _len6 = arguments.length, rest = Array(_len6 > 1 ? _len6 - 1 : 0), _key6 = 1; _key6 < _len6; _key6++) {
            rest[_key6 - 1] = arguments[_key6];
          }

          return (_api6 = this.api).updateItem.apply(_api6, [_extends({}, first, { collectionId: _collection._id })].concat(rest));
        },
        removeItem: function removeItem(first) {
          var _api7;

          for (var _len7 = arguments.length, rest = Array(_len7 > 1 ? _len7 - 1 : 0), _key7 = 1; _key7 < _len7; _key7++) {
            rest[_key7 - 1] = arguments[_key7];
          }

          return (_api7 = this.api).removeItem.apply(_api7, [_extends({}, first, { collectionId: _collection._id })].concat(rest));
        }
      });
    }
  }, {
    key: "item",
    value: function item(_item, collectionId) {
      return _extends({}, _item, {
        update: function update(first) {
          var _api8;

          for (var _len8 = arguments.length, rest = Array(_len8 > 1 ? _len8 - 1 : 0), _key8 = 1; _key8 < _len8; _key8++) {
            rest[_key8 - 1] = arguments[_key8];
          }

          return (_api8 = this.api).updateItem.apply(_api8, [_extends({}, first, { collectionId: collectionId, itemId: _item._id })].concat(rest));
        },

        remove: this.api.updateItem.bind(this.api, { collectionId: collectionId, itemId: _item._id })
      });
    }
  }, {
    key: "webhook",
    value: function webhook(_webhook, siteId) {
      return _extends({}, _webhook, {

        remove: this.api.removeWebhook.bind(this.api, { siteId: siteId, webhookId: _webhook._id })
      });
    }
  }]);

  return ResponseWrapper;
}();

exports.default = ResponseWrapper;
module.exports = exports["default"];