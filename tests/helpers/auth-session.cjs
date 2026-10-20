// Unsigned test token: only for SDK mocks that independently supply a verified
// user. Never accepted by a real provider or used as an application credential.
exports.tokenFor = (id, sessionId='00000000-0000-4000-8000-000000000099') =>
 ['fixture',Buffer.from(JSON.stringify({sub:id,session_id:sessionId})).toString('base64url'),'not-a-signature'].join('.');
exports.sessionFor = id => ({data:{session:{access_token:exports.tokenFor(id)}},error:null});
