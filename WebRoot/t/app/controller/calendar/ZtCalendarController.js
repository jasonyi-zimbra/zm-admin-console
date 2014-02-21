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
 * This class represents a controller that manages calendar.
 *
 * @author Ajinkya Chhatre <achhatre@zimbra.com>
 */

Ext.define('ZCS.controller.calendar.ZtCalendarController', {

    extend: 'ZCS.controller.ZtItemController',

    requires: [
        'Ext.ux.TouchCalendarEventsBase',
        'Ext.ux.TouchCalendarMonthEvents',
        'Ext.ux.TouchCalendarWeekEvents',
        'Ext.ux.TouchCalendarDayEvents',
        'Ext.ux.TouchCalendarEvents',
        'Ext.ux.TouchCalendarSimpleEvents',
        'Ext.ux.TouchCalendarView',
        'Ext.ux.TouchCalendar',
        'ZCS.view.calendar.ZtCalendarToolbar',
        'ZCS.view.calendar.ZtAppointmentForm'
    ],

    config: {

        models: ['ZCS.model.calendar.ZtCalendar'],

        stores: ['ZCS.store.calendar.ZtCalendarStore'],

        views: [
            'ZCS.view.calendar.ZtCalendarView'
        ],

        refs: {
            overview: '#' + ZCS.constant.APP_CALENDAR + 'overview',
            itemPanel: 'appview #' + ZCS.constant.APP_CALENDAR + 'itempanel',
            calendarView: ZCS.constant.APP_CALENDAR + 'itemview',
            calMonthView: 'appview #' + ZCS.constant.APP_CALENDAR + 'itempanel #calMonthView',
            calWeekView: 'appview #' + ZCS.constant.APP_CALENDAR + 'itempanel #calWeekView',
            calDayView: 'appview #' + ZCS.constant.APP_CALENDAR + 'itempanel #calDayView',
            itemPanelTitleBar: 'appview #' + ZCS.constant.APP_CALENDAR + 'itempanel titlebar',
            calToolbar: 'appview #' + ZCS.constant.APP_CALENDAR + 'itempanel caltoolbar',
            appointmentPanel : 'appointmentpanel',
			appointmentTitleBar:  'appointmentpanel #apptTitleOnlyBar',
			appointmentToolbar: 'appointmentpanel #apptToolbar',
			appointmentView : 'appointmentpanel #apptDetails',
			calendarAddressActionsMenu: 'list[itemId=calendarAddressActionsMenu]',
			inviteReplyActionsMenu: 'list[itemId=inviteReplyActionsMenu]',
			appointmentActionsMenu: 'list[itemId=apptActionsMenu]'
		},

        control: {
            calendarView: {
                eventtap: 'onEventTap',
                selectionchange: 'onTimeSlotChange'
			},
			appointmentPanel: {
				cancel:             'doCancel',
				contactTap:         'showMenu'
			},
			'appointmentpanel toolbar button[iconCls=reply]': {
				tap: 'onApptActionsButtonTap'
			},
			'appointmentpanel toolbar button[iconCls=arrow_down]': {
				tap: 'onApptActionsButtonTap'
			},
			calendarAddressActionsMenu: {
				itemtap:            'onMenuItemSelect'
			},
			inviteReplyActionsMenu: {
				itemtap:            'onMenuItemSelect'
			},
			apptActionsMenu: {
				itemtap:            'onMenuItemSelect'
			}
        },

        app: ZCS.constant.APP_CALENDAR
    },

    launch: function() {

	    if (!ZCS.util.isAppEnabled(this.getApp())) {
		    return;
	    }

        this.callParent();

        //Create a toolbar with calendar view buttons - Month, Week, Day, Workweek and Today
        this.createToolbar();
    },

    /*
     * Loads the appointments on application switch
     */
    loadCalendar: function() {
        var defaultQuery = this.getDefaultQuery(),
            me = this;

        //Set the proxies params so this parameter persists between paging requests.
        this.getStore().getProxy().setExtraParams({
            query: defaultQuery
        });

        this.getStore().load({
            calStart: this.getMonthStartTime(),
            calEnd: this.getMonthEndTime(),
            query: defaultQuery,
            callback: function(records, operation, success) {
                if (success) {
                    // Fix for bug: 83607
                    me.refreshCurrentView();
                }
            }
        });
    },

    /*
     * Refreshes and reloads default/last selected calendar view
     */
    refreshCurrentView: function() {
        var monthView = this.getCalMonthView(),
            dayView = this.getCalDayView(),
            weekView = this.getCalWeekView();

        if (!monthView.isHidden()) {
            monthView.view.refreshDelta(0);
        }
        else if (!dayView.isHidden()) {
            dayView.view.refreshDelta(0);
        }
        else if (!weekView.isHidden()) {
            weekView.view.refreshDelta(0);
        }
    },

    /*
     * Invokes when an appointment is tapped
     *
     * @param {ZCS.model.calendar.ZtCalendar} event The Event record that was tapped
     */
    onEventTap: function(event) {
        var msg = Ext.create('ZCS.model.mail.ZtMailMsg'),
            inviteId = event.get('invId'),
            start = event.get('start'),
            me = this;

        msg.save({
            op: 'load',
            id: inviteId,
            apptView: true,
            ridZ: start,
            success: function(record) {
                me.showItem(record, event);
            }
        });
    },

    /**
     * Show appoinment view panel, by sliding it up on an overlay
     * @param {ZCS.model.calendar.ZtCalendar} event The Event record that was tapped
     */

    showItem: function(msg, event) {
		var panel = this.getAppointmentPanel(),
            invite = msg.get('invite'),
            title = Ext.String.htmlEncode(invite.get('subject') || ZtMsg.noSubject);

        panel.setPanel(msg, event);
        this.updateToolbar({isOrganizer: invite.get('isOrganizer')});
        panel.show({
            type:       'slide',
            direction:  'up',
            duration:   250
        });
	    this.updateTitle({title:title});
    },

    updateToolbar: function(params) {

        params = params || {};
		var app = ZCS.util.getAppFromObject(this),
			hideAll = !this.getItem() || params.hideAll || params.isOrganizer;

		Ext.each(ZCS.constant.ITEM_BUTTONS[app], function(button) {
			this.showButton(button.op, !hideAll);
		}, this);

		// Show the ATD options only in case of attendees
		if (params.isOrganizer) {
			Ext.getCmp('editAppt').show();
			Ext.getCmp('inviteActionsAppt').hide();
		} else {
			Ext.getCmp('inviteActionsAppt').show();
			Ext.getCmp('editAppt').hide();
		}
    },

	updateTitle: function(params) {
		var apptTitleBar = this.getAppointmentTitleBar(),
			apptView = this.getAppointmentView(),
			apptViewInner = apptView.element.down('.x-innerhtml');

		if (apptTitleBar && params && params.title != null) {
			apptTitleBar.setHtml(params.title);
			if (params.title) {
				apptTitleBar.show();
			} else {
				apptTitleBar.hide();
			}
		}
		apptViewInner.addCls('top-padding-' + apptTitleBar.element.getHeight());
	},

	/**
	 * Make sure the action menu shows the appropriate action based on the unread status of this conversation.
	 * The action will be either Mark Read or Mark Unread.
	 */
	updateMenuLabels: function(menuButton, params, menu) {

		var menuName = params.menuName;

		if (menuName === ZCS.constant.MENU_CALENDAR_ADDRESS) {
			// Hiding/showing address listitems instead of changing labels
			menu.hideItem(ZCS.constant.OP_ADD_CONTACT, true);
			menu.hideItem(ZCS.constant.OP_EDIT, true);

			// Pick which listitem to show, only if contacts app is enabled
			if (ZCS.constant.IS_ENABLED[ZCS.constant.APP_CONTACTS]) {
				var addr = params.addrObj,
					cachedAddr = ZCS.cache.get(addr && addr.get('email'), 'email');

				if (cachedAddr) {
					menu.hideItem(ZCS.constant.OP_EDIT, false);
				} else {
					menu.hideItem(ZCS.constant.OP_ADD_CONTACT, false);
				}
			}
		}
	},

    onTimeSlotChange: function(view, newDate, oldDate) {
        //Switch to the day view if user taps on a particular date in month view
        ZCS.app.getCalendarController().toggleCalView('day', newDate);
    },

    getDefaultQuery: function() {
        return 'in:calendar';
    },

    createToolbar: function() {
        this.getItemPanelTitleBar().add(Ext.create('ZCS.view.calendar.ZtCalendarToolbar', {
            newButtonIcon: ZCS.constant.NEW_ITEM_ICON[ZCS.constant.APP_CALENDAR]
        }));
    },

    getMonthStartTime: function() {
        var weekStart = this.getCalMonthView().getViewConfig().weekStart,
            firstDay = new Date().setDate(1),  //Month starts with 1
            firstDayDate = new Date(firstDay),
            today = new Date(firstDay).getDay(),
            daysToSubtract = today - weekStart;

        return this.getTimeStamp(firstDayDate, -daysToSubtract);
    },

    getMonthEndTime: function() {
        var daysInWeek = 7,
            weekStart = this.getCalMonthView().getViewConfig().weekStart,
            month = new Date().getMonth(), //Starts from 0 as January
            year = new Date().getFullYear(),
            lastDayDate = new Date(year, month + 1, 0),
            daysToAdd = (daysInWeek + weekStart) - 1;

        return this.getTimeStamp(lastDayDate, daysToAdd);
    },

    getTimeStamp: function(date, daysToAdjust) {
        return new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate() + daysToAdjust,
            date.getHours(),
            date.getMinutes(),
            date.getSeconds(),
            date.getMilliseconds()
        ).getTime();
    },

    toggleCalView: function(viewToShow, date) {
        var monthView = this.getCalMonthView(),
            weekView = this.getCalWeekView(),
            dayView = this.getCalDayView();

        if (!date) {
            switch(viewToShow) {
                case 'month':
                    monthView.show();
                    this.getCalToolbar().down('#monthBtn').setCls('x-button-pressed');
                    weekView.hide();
                    this.getCalToolbar().down('#weekBtn').removeCls('x-button-pressed');
                    dayView.hide();
                    this.getCalToolbar().down('#dayBtn').removeCls('x-button-pressed');
                    break;

                case 'week':
                    weekView.show();
                    this.getCalToolbar().down('#weekBtn').setCls('x-button-pressed');
                    monthView.hide();
                    this.getCalToolbar().down('#monthBtn').removeCls('x-button-pressed');
                    dayView.hide();
                    this.getCalToolbar().down('#dayBtn').removeCls('x-button-pressed');
                    break;

                case 'day':
                    dayView.show();
                    this.getCalToolbar().down('#dayBtn').setCls('x-button-pressed');
                    monthView.hide();
                    this.getCalToolbar().down('#monthBtn').removeCls('x-button-pressed');
                    weekView.hide();
                    this.getCalToolbar().down('#weekBtn').removeCls('x-button-pressed');
                    this.setDayViewConfig(new Date().getTime());
                    break;
            }
        }
        else {
            dayView.show();
            this.getCalToolbar().down('#dayBtn').setCls('x-button-pressed');
            monthView.hide();
            this.getCalToolbar().down('#monthBtn').removeCls('x-button-pressed');
            weekView.hide();
            this.getCalToolbar().down('#weekBtn').removeCls('x-button-pressed');
            this.setDayViewConfig(date);
        }
    },

    setDayViewConfig: function(date) {
        this.getCalDayView().setCustomView({
            weekStart: 0,
            currentDate: new Date(date),
            viewMode: 'day',
            eventStore: Ext.getStore('ZtCalendarStore'),
            plugins: [Ext.create('Ext.ux.TouchCalendarEvents', {
                eventHeight: 'auto',
                eventBarTpl: '<div>{title}&nbsp;&nbsp;&nbsp;<i>{event}</i></div>'
            })]
        });
    },

	doAccept: function(actionParams) {
		this.doInviteReply(ZCS.constant.OP_ACCEPT, actionParams.appt);
	},

	doTentative: function(actionParams) {
		this.doInviteReply(ZCS.constant.OP_TENTATIVE, actionParams.appt);
	},

	doDecline: function(actionParams) {
		this.doInviteReply(ZCS.constant.OP_DECLINE, actionParams.appt);
	},
    /**
     * Sends the attendee response as a notification to the organizer
     */
    doInviteReply: function(action, appt) {
        var invite = appt.get('invite'),
			invId =  appt.get('id'),
            msg = Ext.create('ZCS.model.mail.ZtMailMsg');

        msg.set('origId', invId);  //not sure if origId should be set to invite id
        msg.set('inviteAction', action);
        msg.set('replyType', 'r');

        msg.set('subject', invite.get('subject'));

        var from = ZCS.mailutil.getFromAddress();
        msg.addAddresses(from);

        if (!invite.get('isOrganizer')) {
            var	organizer = invite.get('organizer'),
                organizerEmail = organizer && organizer.get('email'),
                toEmail = organizerEmail || invite.get('sentBy');

            if (toEmail) {
                msg.addAddresses(ZCS.model.mail.ZtEmailAddress.fromEmail(toEmail, ZCS.constant.TO));
            }
        }

        var replyBody = invite.getSummary(true) + ZCS.constant.INVITE_REPLY_TEXT[action] + '<br><br>';

        msg.createMime(replyBody, true);
        var me = this;
        msg.save({
            isInviteReply: true,
            success: function () {
                me.getAppointmentPanel().hide();
                ZCS.app.fireEvent('showToast', ZtMsg.invReplySent);
            }
        });
    },

	doDelete: function(actionParams) {
		console.log("TODO: Delete the appt");
	},

	doMove: function(actionParams) {
		console.log("TODO: Move!!");
	},

	doTag: function(actionParams) {
		console.log("TODO: Tag!!");
	},

	/**
	 * Starts a new compose session.
	 *
	 * @param {String}  addr    email address of recipient (To: field)
	 */
	doCompose: function(actionParams) {
		var	toAddr = ZCS.model.mail.ZtEmailAddress.fromEmail(actionParams.address);
		this.getAppointmentPanel().hide();
		ZCS.app.getComposeController().showComposeForm([toAddr]);
	},

	doAddContact: function(actionParams) {
		var contactCtrl = ZCS.app.getContactController(),
			contact = ZCS.model.contacts.ZtContact.fromEmailObj(actionParams.addrObj);
		this.getAppointmentPanel().hide();
		contactCtrl.showContactForm(ZCS.constant.OP_COMPOSE, contact);
	},

	doEditContact: function(actionParams) {
		var contact = ZCS.cache.get(actionParams.addrObj.get('email'), 'email'),
			contactCtrl = ZCS.app.getContactController();
		contactCtrl.setItem(contact);
		this.getAppointmentPanel().hide();
		contactCtrl.showContactForm(ZCS.constant.OP_EDIT, contact);
	},

	doCancel: function() {
		if (Ext.os.deviceType === "Phone") {
			this.getAppointmentPanel().element.dom.style.setProperty('display', 'none');
		} else {
			this.getAppointmentPanel().hide({
				type: 'fadeOut',
				duration: 250
			});
		}
		var apptTitleBar = this.getAppointmentTitleBar(),
			apptView = this.getAppointmentView(),
			apptViewInner = apptView.element.down('.x-scroll-view .x-innerhtml');

		apptViewInner.removeCls('top-padding-' + apptTitleBar.element.getHeight());
		apptTitleBar.setHtml("");
		apptTitleBar.hide();
	},

	onApptActionsButtonTap: function (button, e) {
		var apptPanel = this.getAppointmentPanel(),
			appt = apptPanel.getAppt();

		if (button.get('iconCls') == 'trash') {
			this.doDelete({appt: appt});
		} else {
			this.showMenu(button, {
				menuName:   button.initialConfig ? button.initialConfig.menuName : undefined,
				appt:       appt
			});
		}
	}
});
