'use strict';
var Respoke = require('../index');
var should = require('should');
var helpers = require('./helpers');
var uuid = require('uuid');

var respoke;

describe('Respoke', function () {
    this.timeout(10000);

    describe('Base methods and properties', function () {
        beforeEach(function () {
            respoke = new Respoke({
                baseURL: helpers.baseURL
            });
        });
        it('has request', function () {
            respoke.request.should.be.a.Function;
        });
        it('has wsCall', function () {
            respoke.wsCall.should.be.a.Function;
        });
        it('is an EventEmitter', function () {
            respoke.on.should.be.a.Function;
            respoke.emit.should.be.a.Function;
        });
        it('has expected properties', function () {
            respoke.tokens.should.be.an.Object;
            (respoke.connectionId === null).should.be.ok;
            (respoke.socket === null).should.be.ok;
            respoke.baseURL.should.be.a.String;
            respoke.baseURL.should.not.be.empty;

            respoke.auth.should.be.an.Object;
            respoke.groups.should.be.an.Object;
            respoke.messages.should.be.an.Object;
            respoke.roles.should.be.an.Object;
            respoke.apps.should.be.an.Object;
            respoke.presence.should.be.an.Object;
        });
    });

    describe('Authentication', function () {

        beforeEach(function () {
            respoke = new Respoke({
                baseURL: helpers.baseURL
            });
        });

        it('authenticates as an admin with username and password', function (done) {
            respoke.auth.admin(helpers.auth, function (err, body) {
                if (err) {
                    return done(err);
                }
                body.token.should.be.a.String;
                done();
            });
        });

        it('fails admin auth with bad credentials', function (done) {
            respoke.auth.admin({
                username: 'ducksized',
                password: 'sea-monkeys'
            }, function (err, body) {
                err.should.be.an.Error;
                should(body.token).be.not.ok;
                done();
            });
        });

        it('uses App-Secret to obtain a working brokered auth token', function (done) {
            respoke.tokens['App-Secret'] = helpers.appSecret;
            respoke.auth.endpoint({
                endpointId: 'billy',
                appId: helpers.appId,
                roleId: helpers.roleId
            }, function (err, body) {
                if (err) {
                    return done(err);
                }
                body.tokenId.should.be.a.String;
                respoke.auth.appAuthSession({
                    tokenId: body.tokenId
                }, function (err, sessionData) {
                    if (err) {
                        return done(err);
                    }
                    respoke.tokens['App-Token'].should.be.a.String;
                    respoke.auth.connect({
                        endpointId: 'billy'
                    });
                    respoke.on('connect', function () {
                        respoke.close(done);
                    });
                    respoke.on('error', done);
                });
            });
        });
    });
    
    

    describe('Apps', function (done) {

        beforeEach(function (done) {
            respoke = new Respoke({
                baseURL: helpers.baseURL
            });
            respoke.auth.admin(helpers.auth, done);
        });

        it('lets you get an array of apps', function (done) {
            respoke.apps.get(function (err, allApps) {
                should.not.exist(err);
                allApps.should.be.an.Array;
                done();
            });
        });

        it('gets a single app by id', function (done) {
            respoke.apps.get({ appId: helpers.appId }, function (err, singleApp) {
                should.not.exist(err);
                singleApp.should.be.an.Object;
                singleApp.id.should.equal(helpers.appId);
                done();
            });
        });

    });

    describe('Roles', function () {

        beforeEach(function (done) {
            respoke = new Respoke({
                baseURL: helpers.baseURL
            });
            respoke.auth.admin(helpers.auth, done);
        });


        it('fetches all roles for an app', function (done) {
            respoke.roles.get({ appId: helpers.appId }, function (err, roles) {
                should.not.exist(err);
                roles.should.be.an.Array;
                done();
            });
        });

        it('creates and removes a role', function (done) {
            var role = helpers.role();
            role.appId = helpers.appId;
            role.name = 'test-role-' + uuid.v4();
            respoke.roles.create(role, function (err, createdRole) {
                should.not.exist(err);
                createdRole.should.be.an.Object;
                createdRole.appId.should.equal(role.appId);
                createdRole.id.should.be.a.String;
                respoke.roles.delete({ roleId: createdRole.id }, function (err) {
                    should.not.exist(err);
                    done();
                });
            });
        });

    });

    describe('Messaging and Groups', function () {
        var endpointId1 = "client1-" + uuid.v4();
        var endpointId2 = "client2-" + uuid.v4();
        var client1 = null;
        var client2 = null;
        var createdClients = 0;

        beforeEach(function (done) {
            createdClients = 0;

            client1 = new Respoke({
                baseURL: helpers.baseURL
            });
            client1.tokens['App-Secret'] = helpers.appSecret;
            client1.auth.connect({ endpointId: endpointId1 });
            client1.on('connect', function (data) {
                createdClients++;
                if (createdClients === 2) {
                    done();
                }
            });
            client1.on('error', function (err) {
                done(err);
            });

            client2 = new Respoke({
                baseURL: helpers.baseURL
            });
            client2.tokens['App-Secret'] = helpers.appSecret;
            client2.auth.connect({ endpointId: endpointId2 });
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
            if (client1.connectionId) {
                client1.close(handler);
            } 
            else {
                createdClients++;
                handler();
            }
            if (client2.connectionId) {
                client2.close(handler);
            }
            else {
                createdClients++;
                handler();
            }
        });

        // client 1 sending a message to client 2
        it.only('sends and receives messages', function (done) {
            var msgText = "Hey - " + uuid.v4();

            client2.on('message', function (data) {
                data.header.type.should.equal('message');
                data.header.from.should.equal(endpointId1);
                data.body.should.equal(msgText);
                done();
            });

            client1.messages.send({ 
                to: endpointId2,
                message: msgText
            }, function (err) {
                if (err) {
                    done(err);
                }
            });
        });

        it('lists groups members and observes presence', function (done) {
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

                // Make sure both members are in the group
                client1.getGroupMembers({ groupId: groupId }, function (err, members) {
                    if (err) {
                        return done(err);
                    }
                    members.should.be.an.Array;
                    var hasClient1 = false;
                    var hasClient2 = false;
                    for (var i = 0; i < members.length; i++) {
                        var memb = members[i];
                        memb.endpointId.should.be.a.String;
                        memb.connectionId.should.be.a.String;
                        if (memb.endpointId === endpointId1) {
                            hasClient1 = true;
                        }
                        if (memb.endpointId === endpointId2) {
                            hasClient2 = true;
                        }
                    }
                    hasClient1.should.be.ok;
                    hasClient2.should.be.ok;

                    // register presence
                    var endpoints = members.map(function (memb) {
                        return memb.endpointId;
                    });
                    var testStatus = 'At lunch';
                    client1.registerPresence(endpoints, function (err) {
                        if (err) {
                            done(err);
                        }
                    });

                    // the test
                    client1.on('presence', function (data) {
                        data.status.should.equal(testStatus);
                        data.header.type.should.equal('presence');
                        data.header.from.should.equal(endpointId2);
                        data.header.fromConnection.should.be.a.String;
                        data.type.should.equal('available');
                        done();
                    });

                    // ensure there was time to subscribe
                    setTimeout(function () {
                        client2.setPresence({ status: testStatus }, function (err) {
                            if (err) {
                                done(err);
                            }
                        });
                    }, 1000);

                });
            }
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
                client2.on('pubsub', function (data) {
                    data.header.from.should.equal(endpointId1);
                    data.header.groupId.should.equal(groupId);
                    data.header.type.should.equal('pubsub');
                    data.message.should.equal(msgText);
                    done();
                });
                client1.sendGroupMessage({
                    groupId: groupId,
                    message: msgText
                }, function (err) {
                    if (err) {
                        return done(err);
                    }
                });
            }
        });

        it('gets join and leave events', function (done) {
            var groupId = 'somegroup-' + uuid.v4();
            var totalJoined = 0;
            var msgText = "Hey - " + uuid.v4();
            var gotJoin = false;
            var alreadyDoned = false;

            client1.join({ groupId: groupId }, function (err) {
                if (err) {
                    return done(err);
                }
                client1.on('join', function (data) {
                    if (data.endpointId === endpointId1) {
                        // ignore self;
                        return;
                    }
                    data.header.type.should.equal('join');
                    data.header.groupId.should.equal(groupId);
                    data.endpointId.should.equal(endpointId2);
                    data.connectionId.should.be.a.String;
                    gotJoin = true;
                });

                setTimeout(function () {

                    client2.join({ groupId: groupId }, function (err) {
                        if (err) {
                            return done(err);
                        }
                        setTimeout(function () {
                            client2.leave({ groupId: groupId }, function (err) {
                                if (err) {
                                    return done(err);
                                }
                            });
                        }, 500);
                    });

                }, 500);
            });

            client1.on('leave', function (data) {
                data.header.type.should.equal('leave');
                data.header.groupId.should.equal(groupId);
                data.endpointId.should.equal(endpointId2);
                data.connectionId.should.be.a.String;

                if (!gotJoin) {
                    return done(new Error("Did not get join event"));
                }
                // Some of the connections are not getting cleaned up properly.
                // This leave is getting called more than once with the same endpointId but
                // different connectionIds.
                if (!alreadyDoned) {
                    alreadyDoned = true;
                    done();
                }
            });

        });


    });

});
