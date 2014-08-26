var respoke = require('../../index');
var should = require('should');
var helpers = require('../helpers');
var uuid = require('uuid');

var Client = respoke.Client;

describe('respoke.Client', function () {
    this.timeout(10000);
    it('connects in developmentMode', function (done) {
        var client = new Client({
            appId: helpers.appId,
            endpointId: "me-" + uuid.v4(),
            developmentMode: true,
            baseURL: helpers.baseURL
        });
        client.on('connect', function () {
            client.close(function (err) {
                if (err) {
                    return done(err);
                }
                done();
            });
        });
        client.on('error', function (err) {
            done(err);
        });
    });

    describe('subscribers', function () {
        
        var client = null;

        beforeEach(function (done) {
            client = new Client({
                appId: helpers.appId,
                endpointId: "bot-" + uuid.v4(),
                developmentMode: true,
                baseURL: helpers.baseURL
            });
            client.on('connect', function (data) {
                done();
            });
            client.on('error', function (err) {
                done(err);
            });
        });

        it('gets all subscribers', function (done) {
            client.getAllSubscribers(function (err, subscribers) {
                should.not.exist(err);
                subscribers.should.be.an.Array;
                done();
            });
        });
    });

    describe('messages', function () {
        var endpointId1 = "client1-" + uuid.v4();
        var endpointId2 = "client2-" + uuid.v4();
        var client1 = null;
        var client2 = null;
        var createdClients = 0;

        beforeEach(function (done) {
            client1 = new Client({
                appId: helpers.appId,
                endpointId: endpointId1,
                developmentMode: true,
                baseURL: helpers.baseURL
            });
            client1.on('connect', function (data) {
                createdClients++;
                if (createdClients === 2) {
                    done();
                }
            });
            client1.on('error', function (err) {
                done(err);
            });
            client2 = new Client({
                appId: helpers.appId,
                endpointId: endpointId2,
                developmentMode: true,
                baseURL: helpers.baseURL
            });
            client2.on('connect', function (data) {
                createdClients++;
                if (createdClients === 2) {
                    done();
                }
            });
            client2.on('error', function (err) {
                done(err);
            });
        });

        afterEach(function (done) {
            var closedTotal = 0;
            var handler = function (err) {
                if (err) {
                    return done(err);
                }
                closedTotal++;
                if (closedTotal === 2) {
                    done();
                }
            };
            client1.close(handler);
            client2.close(handler);
            createdClients = 0;
        });

        // client 1 sending a message to client 2
        it('sends and receives messages', function (done) {
            var msgText = "Hey - " + uuid.v4();

            client2.on('message', function (data) {
                data.header.type.should.equal('message');
                data.header.from.should.equal(endpointId1);
                data.body.should.equal(msgText);
                done();
            });

            client1.sendMessage({ endpointId: endpointId2, message: msgText }, function (err) {
                if (err) {
                    return done(err);
                }
            });
        });

        it('sends and receives group messages', function (done) {
            var groupId = 'somegroup-' + uuid.v4();
            var totalJoined = 0;
            var msgText = "Hey - " + uuid.v4();

            var errHandler = function (err) {
                if (err) {
                    done(err);
                    return;
                }
                totalJoined++;
                if (totalJoined === 2) {
                    doTest();
                }
            };

            client1.join({ groupId: groupId }, errHandler);
            client2.join({ groupId: groupId }, errHandler);

            function doTest() {
                client2.on('message', function (data) {
                    data.header.type.should.equal('pubsub');
                    data.header.from.should.equal(endpointId1);
                    data.header.groupId.should.equal(groupId);
                    done();
                });
                client1.sendMessage({
                    groupId: groupId,
                    message: msgText
                }, function (err) {
                    if (err) {
                        return done(err);
                    }
                });
            }
        });
    });

});
