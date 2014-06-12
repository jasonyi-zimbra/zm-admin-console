/*
 * ***** BEGIN LICENSE BLOCK *****
 * Zimbra Collaboration Suite Web Client
 * Copyright (C) 2013 Zimbra Software, LLC.
 *
 * The contents of this file are subject to the Zimbra Public License
 * Version 1.4 ("License"); you may not use this file except in
 * compliance with the License.  You may obtain a copy of the License at
 * http://www.zimbra.com/license.
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * ***** END LICENSE BLOCK *****
 */

/**
 * This class represents a Zimbra organizer, which may be a folder, a saved search, or a tag.
 * Organizers show up in an overview. A folder may be a mail folder, or an address book.
 *
 * @author Conrad Damon <cdamon@zimbra.com>
 */
Ext.define('ZCS.model.ZtOrganizer', {

	extend: 'ZCS.model.ZtBaseItem',

	requires: [
		'ZCS.model.ZtOrganizerReader',
		'ZCS.model.ZtOrganizerWriter',
		'ZCS.model.ZtSoapProxy'
	],

	config: {

		// Note that 'id' is the ID within Sencha. Since a single organizer from
		// the ZCS server may exist in multiple Sencha stores, and each instance within Sencha
		// must have a unique ID, we need to disambiguate the ID. For example, a tag with 'zcsId'
		// 607 may correspond to ZtOrganizer instances with IDs 'mail-tag-607' and 'contacts-tag-607'.
		// Also, the 'parentItemId' is basically the same as the internal Sencha field 'parentId',
		// but 'parentId' isn't always assigned by the time we need to use it.

		fields: [
			// global fields
			{ name: 'type',             type: 'string' },   // folder, search, or tag
			{ name: 'folderType',       type: 'string' },   // specific type of folder (eg mail folder)
			{ name: 'zcsId',            type: 'string' },   // ID on ZCS server
			{ name: 'parentItemId',     type: 'string' },   // ID of parent organizer
			{ name: 'parentZcsId',      type: 'string' },   // ID of parent on ZCS server
			{ name: 'name',             type: 'string' },   // name on server - not encoded, should not be displayed
			{ name: 'displayName',      type: 'string' },   // HTML-encoded
			{ name: 'path',             type: 'string' },   // full path with / separators
			{ name: 'itemCount',        type: 'int' },      // number of items contained by this organizer
			{ name: 'color',            type: 'int' },      // standard color
			{ name: 'rgb',              type: 'string' },   // extended RGB color
			{ name: 'url',              type: 'string' },   // feeds

			// these fields are used to distinguish organizers that can appear in multiple stores
			{ name: 'app',              type: 'string' },   // app to which this organizer belongs

			// these are internal fields used when a folder has been renamed
			{ name: 'oldParentItemId',  type: 'string' },   // ID of former parent organizer
			{ name: 'oldParentZcsId',   type: 'string' },   // ID of former parent on ZCS server

			// folder fields
			{ name: 'disclosure',       type: 'boolean' },  // override NestedList button behavior

			// mountpoint (link) fields
			{ name: 'isMountpoint',     type: 'boolean' },  // true if this is a link to a remote folder
			{ name: 'remoteAccountId',  type: 'string' },   // account ID of shared folder
			{ name: 'remoteFolderId',   type: 'string' },   // local ID of shared folder
			{ name: 'remoteId',   type: 'string' },         // joined zid and rid
			{ name: 'permissions',      type: 'string' },   // permissions this user has on the remote folder (subset of "rwidaxp")

			// mail folder fields
			{ name: 'unreadCount',      type: 'int' },      // number of unread messages in this folder

			// saved search fields
			{ name: 'query',            type: 'string' },   // search query
			{ name: 'searchTypes',      type: 'string' },   // search types

			// title including count (if count is nonzero, title is bolded)
			{
				name:       'title',
				type:       'string',
				convert:    function(value, record) {
					return record.getTitle(null, true);
				}
			}
		],
	},
	
	statics: {

		/**
		 * Returns an ID for an organizer which should be unique. Note that this is the ID of the
		 * organizer within a Sencha store, and not a DOM ID.
		 *
		 * @param {String}      zcsId       organizer ID on ZCS server
		 * @param {String}      app         ZCS.constant.APP_*
		 *
		 * @return {String}     suitable ID for organizer within a Sencha store
		 */
		getOrganizerId: function(zcsId, app) {
			return Ext.clean([ app, zcsId ]).join(ZCS.constant.ID_JOIN);
		},

		/**
		 * Parse an organizer ID into its component fields.
		 *
		 * @param {String}      id          organizer ID, such as 'mail-overview-2'
		 *
		 * @return {Object}     object with ID fields
		 */
		parseOrganizerId: function(id) {

			var fields = id.split(ZCS.constant.ID_JOIN),
				parsed = {}, i, prop;

			parsed.zcsId = fields.pop();
			for (i = 0; i < fields.length; i++) {
				prop = ZCS.constant.IS_APP[fields[i]] ? 'app' : 'context';
				parsed[prop] = fields[i];
			}

			return parsed;
		},

		/**
		 * Compares two organizers to see which should come first in an overview. Primary key is organizer type:
		 * folders, then searches, then tags. Secondary key within folders is to put system folders first.
		 *
		 * @param {ZtOrganizer} organizer1
		 * @param {ZtOrganizer} organizer2
		 *
		 * @return {Number}
		 */
		compare: function(organizer1, organizer2) {

			if (!organizer1 || !organizer2) {
				return !organizer1 && !organizer2 ? 0 : organizer1 ? 1 : -1;
			}


			if(organizer1.get('zcsId') === 'cancel') {
			    return -1;
			}

			if(organizer2.get('zcsId') === 'cancel') {
				return 1;
			}

			// organizers may come to us as data or as instantiated ZtOrganizer objects
			var get1 = !!organizer1.get,
				get2 = !!organizer2.get,
				orgType1 = organizer1.type || (get1 ? organizer1.get('type') : null),
				orgType2 = organizer2.type || (get2 ? organizer2.get('type') : null),
				id1 = organizer1.zcsId || (get1 ? organizer1.get('zcsId') : null),
				id2 = organizer2.zcsId || (get2 ? organizer2.get('zcsId') : null),
				name1 = organizer1.name || (get1 ? organizer1.get('name') : null),
				name2 = organizer2.name || (get2 ? organizer2.get('name') : null),
				isSystem1 = (orgType1 === ZCS.constant.ORG_FOLDER && id1 <= ZCS.constant.MAX_SYSTEM_ID),
				isSystem2 = (orgType2 === ZCS.constant.ORG_FOLDER && id2 <= ZCS.constant.MAX_SYSTEM_ID),
				sortField1, sortField2;

			if (orgType1 !== orgType2) {
				sortField1 = ZCS.constant.ORG_SORT_VALUE[orgType1] || 0;
				sortField2 = ZCS.constant.ORG_SORT_VALUE[orgType2] || 0;
			}
			else if (isSystem1 !== isSystem2) {
				return isSystem1 ? -1 : 1;
			}
			else if (isSystem1 && isSystem2) {
				sortField1 = ZCS.constant.FOLDER_SORT_VALUE[id1] || 0;
				sortField2 = ZCS.constant.FOLDER_SORT_VALUE[id2] || 0;
			}
			else {
				sortField1 = name1 ? name1.toLowerCase() : '';
				sortField2 = name2 ? name2.toLowerCase() : '';
			}

			return sortField1 > sortField2 ? 1 : (sortField1 === sortField2 ? 0 : -1);
		},

		/**
		 * Fills in a few Sencha-related fields in an organizer data object:
		 *
		 *      id:             ID within a specific Sencha store
		 *      parentItemId:   ID of parent organizer within a specific Sencha store
		 *      leaf:           true if organizer has no children
		 *      disclosure:     true if we should show disclosure icon (to show children)
		 *
		 * @param {Object}      organizer       anonymous object with organizer data
		 * @param {String}      app             app (used to create unique ID)
		 * @param {Boolean}     hasChildren     true if organizer contains child organizers
		 */
		addOtherFields: function(organizer, app, hasChildren) {

			app = organizer.app = app || ZCS.constant.FOLDER_APP[organizer.folderType] || 'default';
			organizer.id = ZCS.model.ZtOrganizer.getOrganizerId(organizer.zcsId, app);
			organizer.parentItemId = ZCS.model.ZtOrganizer.getOrganizerId(organizer.parentZcsId, app);

			if (Ext.isBoolean(hasChildren)) {
				organizer.leaf = !hasChildren;
				organizer.disclosure = hasChildren;
			}
		},

		getNormalizedPath: function (data) {
			var sysId,
				sysName,
				path,
				pathToUse = data.path[0] === "/" ? data.path : "/" + data.path;

			//If we have the luxury of knowing the zcsId, determine the path while
			//considering the zcsId.
			if (data.zcsId) {
				sysId = ZCS.util.localId(data.zcsId);
				sysName = ZCS.constant.FOLDER_SYSTEM_NAME[sysId];
				path = sysName && ZCS.model.ZtOrganizer.isSystem(data) ? '/' + sysName : pathToUse;
			} else {
				//Otherwise, try to hash into system folder ids just by the provided path
				sysId = ZCS.constant.FOLDER_SYSTEM_ID[data.path];

				if (sysId) {
					sysName = ZCS.constant.FOLDER_SYSTEM_NAME[sysId];
					path = sysName ? '/' + sysName : pathToUse;
				} else {
					path = pathToUse;
				}
			}

			return path;
		},


		/**
		 * Returns true if this organizer is some type of folder (mail folder, address book, calendar, etc).
		 *
		 * @returns {boolean}   true if this organizer is some type of folder (mail folder, address book, calendar, etc)
		 */
		isFolder: function(data) {
			return data.type === ZCS.constant.ORG_FOLDER;
		},

		/**
		 * Returns true if this is a system folder (Inbox, Trash, Contacts, etc).
		 *
		 * @returns {boolean}   true if this is a system folder (Inbox, Trash, Contacts, etc)
		 */
		isSystem: function(data) {
			return ZCS.model.ZtOrganizer.isFolder(data) && (ZCS.util.localId(data.zcsId) <= ZCS.constant.MAX_SYSTEM_ID);
		}
	},

	constructor: function(data, id, raw) {

        // Setting these fixes bug in framework when instance of this record is already cached
 	    this.modified = {};
        this.raw = raw || data || {};
        this.stores = [];

        this.callParent(arguments);

		this.useSoapProxy(true);
	},

	/**
	 * Set up organizers to use one of two different proxies, SOAP or memory.
	 *
	 * @param {Boolean} useSoap     if true, use SOAP; otherwise, use a memory proxy
	 * @private
	 */
	useSoapProxy: function(useSoap) {

		this._proxy = ZCS.model.ZtOrganizer.singleInstanceProxy;
	},

	/**
	 * Returns true if this organizer is a feed (RSS or Atom)
	 *
	 * @returns {boolean}   true if this organizer is a feed (RSS or Atom)
	 */
	isFeed: function() {
		return !!(this.get('url'));
	},

	/**
	 * Returns true if this folder is the given folder or a subfolder of it.
	 *
	 * @param {String}  folderId        ID of folder to check against
	 * @returns {boolean}   true if this folder is the given folder or a subfolder of it
	 */
	isUnder: function(folderId) {

		if (ZCS.util.folderIs(this, folderId)) {
			return true;
		}

		var folder = ZCS.session.getOrganizerModel(this.get('parentItemId'));
		while (folder && folder.get('zcsId') !== ZCS.constant.ID_ROOT) {
			if (ZCS.util.folderIs(folder, folderId)) {
				return true;
			}
			folder = ZCS.session.getOrganizerModel(folder.get('parentItemId'));
		}

		return false;
	},

	/**
	 * Returns the full path for this organizer based on its parent chain.
	 *
	 * @returns {string}    path
	 */
	calculatePath: function() {

		var pathParts = [],
			folder = this;

		while (folder && folder.get('zcsId') !== ZCS.constant.ID_ROOT) {
			pathParts.unshift(folder.get('name'));
			folder = ZCS.session.getOrganizerModel(folder.get('parentItemId'));
		}

		return '/' + pathParts.join('/');
	},

	/**
	 * Returns true if deleting an item from this folder results in permanent deletion (rather
	 * than just moving to Trash).
	 *
	 * @returns {boolean}   true if deleting an item from this folder results in permanent deletion
	 */
	deleteIsHard: function() {
		return this.isUnder(ZCS.constant.ID_TRASH) || this.isUnder(ZCS.constant.ID_JUNK);
	},

	/**
	 * Returns the query for this organizer that will return its contents.
	 *
	 * @return {string}     query
	 */
	getQuery: function() {

		var type = this.get('type');

		if (this.isFolder()) {
			var path = this.get('path');

			if (this.isSystem()) {
				path = path.toLowerCase();
			}
			// normalize path to omit leading /
			path = (path[0] === '/') ? path.substr(1) : path;

			return 'in:"' + path + '"';
		}
		else if (type === ZCS.constant.ORG_SEARCH) {
			return this.get('query');
		}
		else if (type === ZCS.constant.ORG_TAG) {
			return 'tag:"' + this.get('name') + '"';
		}
	},

	/**
	 * Returns the name that should be used to group this type of organizer.
	 * For a folder, that's the folder type; otherwise, it's just the type.
	 *
	 * @returns {string}    group name
	 */
	getGroupName: function() {
		var type = this.get('folderType') || this.get('type');
		return ZCS.constant.ORG_NAME[type] || '';
	},

	/**
	 * Returns a string that represents this organizer.
	 *
	 * @param {String}      defaultText     text to use if there is no name
	 * @param {Boolean}     showCount       if true, show number of items
	 * @return {String} organizer title
	 */
	getTitle: function(defaultText, showCount) {

		var	organizerName = Ext.String.htmlEncode(this.get('name')),
			folderType = this.get('folderType'),
			title = organizerName || defaultText || '';

		if (organizerName) {
			if (folderType === ZCS.constant.ORG_MAIL_FOLDER) {
				var unread = showCount ? this.get('unreadCount') : 0;
				title = (unread > 0) ? organizerName + ' (' + unread + ')' : organizerName;
			}
		}

		return title;
	},

	handleDeleteNotification: function() {
		this.destroy();
	},

	handleModifyNotification: function(modify) {

        this.disableDefaultStoreEvents();

		// Use reader to perform any needed data transformation
		var reader = ZCS.model.ZtOrganizer.singleInstanceProxy.getReader(),
			app = this.get('app'),
			data = reader.getDataFromNode(modify, this.get('type'), app, []);

		if (modify.l) {
			// these are used to help UI widgets find a folder node so it can be moved
			this.set('oldParentItemId', this.get('parentItemId'));
			this.set('oldParentZcsId', this.get('parentZcsId'));
			// now we can update the current ID fields
			this.set('parentItemId', ZCS.model.ZtOrganizer.getOrganizerId(data.parentZcsId, app));
			this.set('parentZcsId', data.parentZcsId);
		}

		// Update the unread count before the title since the title contains the unread count.
		// Need to reset title because Sencha does not recalculate converted fields.
		if (modify.u != null) {
			this.set('unreadCount', data.unreadCount);
			this.set('title', this.get('title'));
		}

		if (modify.name) {
			this.set('name', data.name);
			this.set('title', this.get('title'));
		}
		if (modify.absFolderPath) {
			this.set('path', data.path);
		}

		if (modify.color) {
			this.set('color', data.color);
		}
		if (modify.rgb) {
			this.set('rgb', data.rgb);
		}

        if (modify.n) {
            this.set('itemCount', data.itemCount);
//            this.set('title', this.get('title'));
        }

		this.enableDefaultStoreEvents();
	},


	/**
	 * Returns true if this organizer is a valid assignment target for the given item (ie, the item
	 * is getting moved to this folder or is getting this tag).
	 *
	 * @param {ZtItem}      item        item
	 * @return {Boolean}
	 */
	isValidAssignmentTarget: function(item) {

		var	type = this.get('type');

		if (type === ZCS.constant.ORG_TAG) {
			return !item.hasTag(this);
		}
		else {
			return this.mayContain(item);
		}
	},

	/**
	 * Returns true if the given item can be moved to this folder.
	 *
	 * @param {ZtItem|ZtOrganizer}  what    the item or folder being moved
	 * @return {Boolean}    true if the item or folder can be moved to this folder
	 */
	mayContain: function(what) {

		if (!what) {
			return true;
		}
		if (this.isFeed()) {
			return false;
		}

		var	myId = this.get('zcsId'),
			myParentId = this.get('parentZcsId'),
			myType = this.get('type'),
			myFolderType = (myType === ZCS.constant.ORG_FOLDER) ? this.get('folderType') : null,
			isTrashFolder = ZCS.util.folderIs(this, ZCS.constant.ID_TRASH),
			isJunkFolder = ZCS.util.folderIs(this, ZCS.constant.ID_JUNK),
			isDraftsFolder = ZCS.util.folderIs(this, ZCS.constant.ID_DRAFTS);

		if (what instanceof ZCS.model.ZtOrganizer) {

			var type = what.get('type'),
				folderType = (type === ZCS.constant.ORG_FOLDER) ? what.get('folderType') : null,
				id = what.get('zcsId'),
				parentId = what.get('parentZcsId');

			// folders can only be moved into a parent of the same folder type
			if (!folderType || folderType !== myFolderType) {
				return false;
			}

			// can't move folder into itself, its current parent, or a child folder
			if (id === myId || parentId === myId || id === myParentId) {
				return false;
			}

			// Drafts and Junk cannot have subfolders
			if (isDraftsFolder || isJunkFolder) {
				return false;
			}

			// Cannot move a folder into a mountpoint
			if (this.get('isMountpoint')) {
				return false;
			}
		}
		else if (what instanceof ZCS.model.ZtItem) {

			var itemFolderId = what.get('folderId'),
				isDraft = what.get('isDraft');

			// can't move an item to its current folder
			// just check messages for now
			// TODO: iterate through conv messages to see if at least one is not in this folder
			if (myId === itemFolderId && what.get('type') === ZCS.constant.ITEM_MESSAGE) {
				return false;
			}

			// a draft can only be moved into Trash or Drafts
			if (isDraft && !isDraftsFolder && !isTrashFolder) {
				return false;
			}

			// only drafts can be moved into Drafts
			if (isDraftsFolder && !isDraft) {
				return false;
			}

            // disable Distribution lists if contact is being moved
            if (ZCS.util.folderIs(this, ZCS.constant.ID_DLS) && what.get('type') === ZCS.constant.ITEM_CONTACT) {
                return false;
            }

			// if this is a mountpoint, make sure we have write on remote folder
			if (this.get('isMountpoint')) {
				return this.hasPermission(ZCS.constant.PERM_WRITE);
			}
		}
		else {
			return false;
		}

		return true;
	},

	isOutbound: function() {
		return ZCS.util.isOutboundFolderId(this.get('zcsId'));
	},

	/**
	 * Returns true if this organizer is movable.
	 */
	isMovable: function () {
		// TO DO - implement this
		return true;
	},

	/**
	 * Returns true if this organizer is deletable.
	 */
	isDeletable: function () {
		// TO DO - implement this
		return !ZCS.util.folderIs(this, ZCS.constant.ID_TRASH);
	},

	/**
	 * Returns true if this folder is a mountpoint and has the given permission, or if this folder is not a mountpoint.
	 *
	 * @param {String}  permission      one of rwidaxp
	 * @returns {boolean}   true if perm is present, or this not a mountpoint
	 */
	hasPermission: function(permission) {

		var perms = this.get('isMountpoint') && this.get('permissions');
		if (!perms) {
			return true;
		}
		perms = perms.replace(/-\w/g, '');  // remove negative perms
		return perms.indexOf(permission) !== -1;
	},

	isFolder: function() {
		return ZCS.model.ZtOrganizer.isFolder(this.data);
	},

	isSystem: function() {
		return ZCS.model.ZtOrganizer.isSystem(this.data);
	},

	//This function causes alot of the sort thrashing, just neuter it and handle sorting ourselves.
	afterEdit: function () {
		this.disableStoreSorting();
		this.callParent(arguments);
		this.enableStoreSorting();
	}
}, function () {
	var urlBase = ZCS.constant.SERVICE_URL_BASE;
	
	this.singleInstanceProxy = Ext.factory({
		type:   'soapproxy',
		// our server always wants us to POST for API calls
		actionMethods: {
			create  : 'POST',
			read    : 'POST',
			update  : 'POST',
			destroy : 'POST'
		},
		headers: {
			'Content-Type': 'application/soap+xml; charset=utf-8'
		},
		// prevent Sencha from adding junk to the URL
		pageParam: false,
		startParam: false,
		limitParam: false,
		noCache: false,

		api: {
			create:     urlBase + 'CreateFolderRequest',
			read:       urlBase + 'GetFolderRequest',
			update:     urlBase + 'FolderActionRequest',
			destroy:    urlBase + 'FolderActionRequest'
		},
		reader: 'organizerreader',
		writer: 'organizerwriter'
	}, 'ZCS.model.ZtSoapProxy', null, 'proxy');

	//Define a single soap proxy for organizers to use.
});
