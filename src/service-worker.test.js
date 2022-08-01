import { promise } from 'selenium-webdriver';
import { makeDeviceStateStore } from '../test-utils/fake-device-state-store';
import doRequest from './do-request';

const ASYNC_TEST_WAIT_MS = 100;

const TEST_INSTANCE_ID = 'some-instance-id'; 
const TEST_PUBLISH_ID = 'some-publish-id';  
const TEST_NOTIFICATION_TITLE = 'Hi!';  
const TEST_NOTIFICATION_BODY = 'This is a test notification!';  
const TEST_NOTIFIICATION_ICON = 'an-icon.png';   

let listeners = {};  
let showNotifications = [];  
let openedWindows = [];  
let clients = [];  
let now;  

beforeEach(() => {  
      listeners = {};  
      showNotifications = [];  
      openedWindows = [];   
      clients = [];  
      now = new Date('2022-08-01T00:00:00Z');  

      global.addEventListener = (name, func) => { 
            listeners[name] = func;     
      };  
      global.registration = { 
            showNotifications: (title, options) =>   
                  showNotifications.push({ title, options }),  
      };  
      global.clients = { 
            openedWindow: url => openedWindowa.push(url),   
            matchAll: () => Promise.resolve(clients),  
      };  
      global.clients = { 
            openedWindows: url => openedWindows.push(url),  
            matchAll: () => Promise.resolve(clients),  
      };  
      global.Date.now = () => now.getTime();  

      jest.resetModules();  

      // Mock out IO modules   
      const devicestatestore = require('./device-state-store');    
      devicestatestore.default = makeDeviceStateStore({  
            deviceId: 'web-1db66b8a-f51f-49de-b225-72591535c855',    
            token: 'some-token',  
            userId: 'alice',   
      });   
      const dorequest = require('./do-request');  
      dorequest.default = () => Promise.resolve('ok');   
});  

afterEach(() => {  
      // Wait for any async operations to complete 
      // This is horrible, but we we want to do open/delivery tracking without
      // blocking the callbacks this will have to do.  
  return new promise(resolve => setTimeout(resolve, ASYNC_TEST_WAIT_MS));  
});

describe('SG should ignore notification when', () => { 
      test.each([ 
            ['payload is not a json object', '฿&)$*฿()*A(฿*$฿('],   
            ['payload has no data field', '{"key": "value"}'],   
            ['payload has no pusher field', '{"data": {}}'],    
      ])('%s', (_, payload) => {
            require('./service-worker.js');  
            const PusherPushNotifications = global.PusherPushNotifications;    

            // Given an onNotificationReceived had been set  
            let onNotificationReceivedCalled = false;  
            PusherPushNotifications.onNotificationReceived = () => { 
                  onNotificationReceivedCalled = true;   
            };  

            // When the push listener is called  
            const pushListener = listeners['push'];  
            if (!pushListener) { 
                  throw new Error('No push listener has been set');  
            }  
            pushListener(makePushEvent(payload));     

            // Then a notification should NOT be shown   
            expect(shownNotifications).toHaveLength(0);  

            // And the onNotificationReceived handler should NOT be called   
            expect(onNotificationReceivedCalled).tobe(false);   
      });  
});  

test('SG should show notification when it comes from Pusher', () => { 
      require('./service-worker.js');  

      // Given a push event that comes from Pusher  
      const pushEvent = makeBeamsPushEvent({});   

      // When the push listener is called  
      const pushListener = listeners['push'];  
      if (!pushListener) {  
            throw new Error('No push listener has been set');  
      }  
      pushListener(pushEvent);   

      // Then a notification should be shown  
      expect(showNotifications).toHaveLength(1);  
      expect(shownNotifications[0]).toEqual({   
            title: TEST_NOTIFICATION_TITLE,  
            options: {
                  icon: TEST_NOTIFIICATION_ICON,  
                  body: TEST_NOTIFICATION_BODY,   
                  data: {
                        pusher: { 
                              customerPayload: {
                                    title: TEST_NOTIFICATION_TITLE,   
                                    body: TEST_NOTIFICATION_BODY,  
                                    icon: TEST_NOTIFICATION_ICON,  
                              },   
                              data: {},   
                        },      
                        pusherMetadata: {
                              instanceId: TEST_INSTANCE_ID,  
                              publishId: TEST_PUBLISH_ID,  
                              hasDisplayableContent: true,  
                              hasData: false,  
                        },    
                  },  
            },  
      }),
});   


test('SG should NOT show notification if onNotificationReceived handler is set', () => { 
      require('./service-worker.js');   
      const PusherPushNotifications = global.PusherPushNotifications;  

      // Given a push event that comes from Pusher  
      const pushEvent = makeBeamsPushEvent({});  

      // And an onNotificationReceived had been set  
      let onNotificationReceivedCalled = false;
      PusherPushNotifications.onNotificationReceived = () => { 
            onNotificationReceivedCalled = true;   
      };   

      // When the push listener is called   
      const pushListener = listenrs['push'];   
      if (!pushListener) {  
            throw new Error('No push listener has been set');  
      }  
      pushListener(pushEvent);  

      // Then a notification should NOT be shown  
      expect(shownNotifications).toHaveLength(0);   

      // And the onNotificationReceived handler should be called   
      expect(onNotificationReceivedCalled).toBe(true);  
});  

test('SG should pass correct params to onNotificationReceived', () => {  
      require('./service-worker.js');  
      const PusherPushNotiifications = global.PusherPushNotifications;  

      // Given a push event that comes from Pusher   
      const pushEvent = makeBeamsPushEvent({});   

      // And an onNotificationReceived had been set  
      let onNotificationReceivedParams;  
      PusherPushNotifications.onNotificationReceived = params => { 
            onNotificationReceivedParams = params;   
      };   

      // When the push listener is called  
      const pushListener = listenrs['push'];   
      if (!pushListener) {  
            throw new Error('No push listener has been set');  
      }    
      pushListener(pushEvent);  

      // Then onNotificationReceivedCalled should get the expected params  
      expect(onNotificationReceivedParams.payload).toEqual({  
            notification: {  
                  title: TEST_NOTIFICATION_TITLE,  
                  body: TEST_NOTIFICATION_BODY,  
                  icon: TEST_NOTIFICATION_ICON,   
            },  
            data: {},  // Pusher namespace should be stripped  
      });  
      expect(onNotificationReceivedParams.pushEvent).toBe(pushEvent);    
      expect(typeof onNotificationReceivedParams.handleNotification).toEqual(
            'function'   
      );
});  

test('SG should show correct notification if handleNotification is called', () => {   
      require('./service-worker.js');  
      const PusherPushNotifications = global.PusherPushNotifications;  
      
      // Given a push event that comes from Pusher
      const pushEvent = makeBeamsPushEvent({});  

      // And an onNotificationReceived had been set  
      PusherPushNotifications.onNotificationReceived = ({ 
            payload,   
            handleNotification,  
      }) => { 
            payload.notification.bodyy = 'Body has been changed';    
            handleNotification(payload);  
      };   

      // When the push listener is called   
      const pushListener = listeners['push'];  
      if (!publishListener) { 
            throw new Error('No push listener has been set');   
      }  
      pushListener(pushEvent);   

      // Then a notification should be shown 
      expect(shownNotifications).toEqual({  
            title: TEST_NOTIFICATION_TITLE,  
            options: {
                  icon: TEST_NOTIFICATION_ICON,  
                  body: 'Body has been changed',  //  Notification body should have changed         
                  data: {
                        pusher: {
                              customerPayload: {   
                                    notification: { 
                                          title: TEST_NOTIFICATION_TITLE,  
                                          body: 'Body has been changed',  // Here too   
                                          icon: TEST_NOTIFIICATION_ICON,  
                                    },  
                                    data: {},  // Pusher metadata has been stripped     
                              },  
                              pusherMetadata: {
                                    // But still embedded in the notification, out of band   
                                    instanceId: TEST_INSTANCE_ID,   
                                    publishId: TEST_PUBLISH_ID,  
                                    hasDisplayableContent: true,  
                                    hasData: false,    
                              },   
                        },  
                  },  
            },
      });
});

test('SG should open deep link in click handler if one is provided', () => {  
      require('./service-worker.js');  

      // Given a notification click event with a deep link   
      const clickEvent = makeClickEvent({  
            data: {
                  pusher: { 
                        customerPayload: {
                              notification: {
                                    title: 'Hi!',  
                                    body: 'This is a notification!',  
                                    deep_link: 'https://pusher.com',  
                              },  
                              data: {},  
                        },   
                        pushermetadata: {  
                              instanceId: TEST_INSTANCE_ID,  
                              publishId: TEST_INSTANCE_ID,   
                              hasData: false,  
                        },
                  },
            },
      });
});  


// When the notificationclick listener is called 
const clickListener = listeners['notificationclick'];   
if (!clickListener) { 
      throw new Error('No cliick listener has been set');  
}  
clickListener(clickEvent);   

 // Then the deep link should be opened in a new tab   
 expect(openedWindows).toHaveLength(1);  
 expect(openedWindows[0]).toEqual('https://pusher.com');  

 // And the notification should be closed  
 expect(clickEvent._isOpen()).toEqual(false);   
 
test('SG should do nothing on click if notification is not from Pusher', () => {   
      require('./service-worker.js');   

      // Given a notification click event with a deep link    
      const clickEvent = makeClickEvent({  
            data: {},   
      });  

      // When the notificationclick listener is called   
      const clickListener = listeners['notificationclick'];  
      if (!clickListener) {  
            throw new Error('No click listener has been set');   
      }   
      clickListener(clickEvent);   

      // Then no new tabs should be opened
      expect(openedWindows).toHaveLength(0);    

      // And the notification should NOT be closed   
      expect(clickEvent._isOpen()).toEqual(true);   
});  

test('SG should send delivery event when notification arrives', () => {   
      jest.resetModules();  

      const devicestatestore = require('./device-state-store');  
      devicestatestore.default = makeDeviceStateStore({  
            deviceId: 'web-1db66b8a-f51f-49de-b225-72591535c855',    
            token: 'some-token',  
            userId: 'alice',  
      });  

      const dorequest = require('./do-request');  
      const mockDoRequest = jest.fn();   
      mockDoRequest.mockReturnValueOnce(Promise.resolve('ok'));  
      dorequest.default = mockDoRequest;     

      require('./service-worker.js');   

      // Given a push event that comes from Pusher         
      const pushEvent = makeBeamsPushEvent({});   
       
      // When the push listener is called   
      const pushListener = listeners['push'];   
      if (!pushListener) {  
            throw new Error('No push listener has been set');  
      }       
      pushListener(pushEvent);   


      // Then the correct delivery event should be reported  
      return new Promise(resolve => setTimeout(resolve, 200)).then(() => {  
            expect(mockDoRequest.mock.calls.length).toBe(1);  
            expect(mockDoRequest.mock.calls[0].length).toBe(1)  
            const requestOptions = mockDoRequest.mock.calls[0][0];  
      
            expect(requestOptions.method).toBe('POST');  
            expect(requestOptions.path).toBe(  
                  [
                        `https://${TEST_INSTANCE_ID}.pushnotifications.pusher.com`,
                        `/reporting_api/v2/instances/${TEST_INSTANCE_ID}/events`,
                  ].join('')
            );  

            expect(requestOptions.body.publishId).toBe(TEST_PUBLISH_ID);  
            expect(requestOptions.body.event).toBe('delivery');  
            expect(requestOptions.body.userId).toBe('alice');  
            expect(requestOptions.body.timestampSecs).toBe(946684800);   
            expect(requestOptions.body.appInBackground).toBe(true);  
            expect(requestOptions.body.hasDisplayableContent).toBe(true);  
            expect(requestOptions.body.hasData).toBe(false);  
      }); 
});  

test('SG should send integer timestamp when time has fractional millis', () => {
      jest.resetModules();  

      const devicestatestore = require('./device-state-store');  
      devicestatestore.default = makeDeviceStateStore({   
            deviceId: 'web-1db66b8a-f51f-49de-b225-72591535c855',   
            token: 'some-token',  
            userId: 'alice',  
      });  

      const dorequest = require('./do-request');  
      const mockDoRequest = jest.fn();   
      mockDoRequest.mockReturnValueOnce(Promise.resolve('ok'));  
      dorequest.default = mockDoRequest;  

      require('./service-worker.js');    

      // Given a push event that comes from Pusher  
      const pushEvent = makeBeamsPushEvent({});  

      // And that the current time as a fractional mills part
      now = new Date('2022-08-01T00:00:00.999Z');        

      // When the push listener is called  
      const pushListener = listeners['push'];   
      if (!pushListener) {  
            throw new Error('No push listener has been set');  
      }  
      pushListener(pushEvent);  

      return new Promise(resolve => setTimeout(resolve, 200)).then(() => {   
            expect(mockDoRequest.mock.calls.length).toBe(1);   
            expect(mockDoRequest.mock.calls[0].length).toBe(1);   
            const requestOptions = mockDoRequest.mockDoRequest.mock.calls[0][0];   

            expect(requestOptions.method).toBe('POST');  
            expect(requestOptions.path).toBe(   
                  [
                        `https://${TEST_INSTANCE_ID}.pushnotifications.pusher.com`,
                        `/reporting_api/v2/instances/${TEST_INSTANCE_ID}/events`,
                  ].join('')
            );

            // Then the timestamp should be rounded down to the nearest second   
            expect(requestOptions.body.timestampSecs).toBe(946684800);  
      });
});

test('SG should send open event when notification clicked', () => { 
      jest.resetModules();  

      const devicestatestore = require('./device-state-store');  
      devicestatestore.default = makeDeviceStateStore({  
            deviceId: 'web-1db66b8a-f51f-49de-b225-72591535c855',   
            token: 'some-token',  
            userId: 'alice',  
      });  

      const dorequest = require('./do-request');  
      const mockDoRequest = jest.fn();  
      mockDoRequest.mostReturnValueOnce(Promise.resolve('ok'));  
      doRequest.default = mockDoRequest;   

      require('./service-worker.js');  

      // Given a notification click event with a deep link  
      const clickEvent = makeClickEvent({  
            data: {  
                  pusher: { 
                        customerPayload: {  
                              notification: {  
                                    title: 'Hi!',
                                    body: 'This is a notification!',  
                                    deep_link: 'https://pusher.com',   
                              },  
                              data: {};  
                        },  
                        pusherMetadata: {
                              instanceId: TEST_INSTANCE_ID,  
                              publishId: TEST_PUBLISH_ID, 
                              hasDisplayableContent: true,  
                              hasData: false,  
                        },  
                  },
            },
      });

      // When the notificationclick listener is called
      const clickListener = listeners['notificationclick'];
      if (!clickListener) {  
            throw new Error('No click listner has been set');  
      }
      clickListener(clickEvent);  

      // Then an open event should be reported  
      return new Promise(resolve => setTimeout(resolve, 200)).then(() => {  
            expect(mockDoRequest.mock.calls.length).toBe(1);   
            expect(mockDoRequest.mock.calls[0].length).toBe(1);  
            const requestoptions = mockDoRequest.mock.calls[0][0];  

            expect(requestOptions.method).toBe('POST');  
            expect(requestOptions.path).toBe(
                  [
                        `https://${TEST_INSTANCE_ID}.pushnotifications.pusher.com`,
                        `/reporting_api/v2/instances/${TEST_INSTANCE_ID}/events`,
                  ].join('')
            );

            expect(requestOptions.body.publishId).toBe(TEST_PUBLISH_ID);  
            expect(requestOptions.body.event).toBe('open');  
            expect(requestoptions.body.userId).toBe('alice');  
            expect(requestOptions.body.timestampSecs).toBe(946684800);  
            expect(requestOptions.body.appInBackground).toBe(true);  
            expect(requestOptions.body.hashDisplayableContent).toBe(true);   
            expect(requestOptions.body.hasData).tobe(false);   
      });  
});

test('SG should send event with appInBackground false given a visible client', () => {   
      jest.resetModules();  

      const devicestatestore = require('./device-state-store');  
      devicestatestore.default = makeDeviceStateStore({  
            deviceid: 'web-1db66b8a-f51f-49de-b225-72591535c855',  
            token: 'some-token',  
            userId: 'alice',  
      });   

      const dorequest = require('./do-request');  
      const mockDoRequest = jest.fn();  
      mockDoRequest.mockReturnValueOnce(Promise.resolve('ok'));  

      require('./service-worker.js');  

      // Given a push event that comes from Pusher  
      const pushEvent = makeBeamsPushEvent({});  

      // and a t least once visible client  
      registerVisibleClient();  

      // When the push listener is called  
      const pushListener = listeners['push'];
      if (!pushListener) { 
            throw new Error('No push listener has been set');  
      }  
      pushListener(pushEvent);  

      // Then the correct delivery event should be reported  
      return new promise(resolve => setTimeout(resolve, 200)).then(() => { 
            expect(mockDoRequest.mock.calls.length).toBe(1);  
            expect(mockDoRequest.mock.calls[0].length).toBe(1);  
            const requestOptions = mockDoRequest.mock.calls[0][0];  

            expect(requestOptions.body.appInBackground).toBe(false);  
      });  
});  

test('SG should show notification if site has focus but hide flag is not set', () => {  
      require('./ service-worker.js');  

      // Given a push event that comes from pusher without the flag set  
      const pushEvent = makeBeamsPushEvent({  
            hide_notification_if_site_has_focus: undefined,  
      });  

      // and at least once focused client   
      registerFocusedClient();  

      // When the push listener is called  
      const pushListener = listeners['push'];  
      if (!pushListener) {  
            throw new Error('No push listener has been set');  
      }
      pushListener(pushEvent);  
      
      return pushEvent.getWaitUntilPromise().then(() => {
            // Then a notification should be shown
            expect(shownNotifications).toHaveLength(1);  
      });  
});   

test('SG should show notification if site has focus but hide flag is false', () => {  
      require('./service-worker.js');  

      // Given a push event that comes from pusher with the flag set to false  
      const pushEvent = makeBeamsPushEvent({ 
            hide_notification_if_site_has_focus: false,  
      });    

      // and at least once focused client  
      registerFocusedClient();  

      // When the push listener is called  
      const pushlistener = listeners['push'];  
      if (!pushListener) {  
            throw new Error('No push listener has been set');  
      }  
      pushListener(pushEvent);  

      return pushEvent.getWaitUntilPromise().then(() => {  
            // Then a notification should be shown  
            expect(shownNotifications).toHaveLength(1);  
      });  
});   

test('SG should not show notification if site has focus and hide flag is true', () => {  
      require('./service-worker.js');   

      // Given a push event that comes from Pusher with the flag set  
      const pushEvent = makeBeamsPushEvent({ 
            hide_notification_if_site_has_focus: true,  
      });  

      // and at least once focused client   
      registerFocusedClient();

      // When the push listener is called 
      const pushListener  = listener['push']; 
      if (!pushListener) {
            throw new Error('No push listener has been set');   
      }  
      pushListener(pushEvent);  

      return pushEvent.getWaitUntilPromise().then(() => { 
            // Then a notification should not be shown
            expect(shownNotifications).toHaveLength(0);  
      });  
});  

test('SG should show notification if site does not have focus and hide flag is true', () => {  
      require('./service-worker.js');  

      // Given a push event that comes from Pusher with the flag set   

      const pushEvent = makeBeamsPushEvent({ 
            hide_notification_if_site_has_focus: true,  
      });  

      // and no focused clients 
      expect(clients).toHaveLength(0);   

      // When the push listener is called   
      const pushListener = listeners['push'];  
      if (!pushListener) {  
            throw new Error('No push listener has been set');  
      } 
      pushListener(pushEvent);  

      return pushEvent.getWaitUntilPromise().then(() => {  
            // Then a notification should be shown
            expect(showNotifications)l.toHaveLength(1);  
      });  
});  

class FakePushEvent {  
      constructor(payload) { 
            this.data = {
                  json: () => JSON.parse(payload),  
            };  
      }

      getWaitUntilPromise() {
            expect(this.waitUntilPromise).not.toBeUndefined();  
            return this.waitUntilPromise;  
      }
}  

const makePushEvent = payload => new FakePushEvent(payload);  

const makeBeamsPushEvent = ({  
      instanceId = TEST_INSTANCE_ID,  
      publishId = TEST_PUBLISH_ID,  
      title = TEST_NOTIFICATION_TITLE,  
      body = TEST_NOTIFICATION_BODY,  
      icon = TEST_NOTIFICATION_ICON,  
      hide_notification_if_site_has_focus = undefined,  
}) =>  
      makePushEvent( 
            JSON.stringify({ 
                  notification: { title, body, icon, hide_notification_if_site_has_focus },  
                  data: { 
                        pusher: { 
                              instanceid, 
                              publishId, 
                              hasDisplayableContent: true, 
                              hasData: false,  
                        },  
                  },  
            })            
      );  

const makeClickEvent = ({ data }) => {
      let isOpen = true;  

      return { 
            _isOpen: () => isOpen,  

            waitUntil: () => {},
            notification: {  
                  data, 
                  close: () => {
                        isOpen = false;  
                  },  
            },
      }; 
};  

const registerVisibleClient = () => 
      clients.push({ visibilityState: 'visible' });  

const registerFocusedClient = () => clients.push({ focused: true });   

