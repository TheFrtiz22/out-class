// Supabase CLI's official fallback registries, restricted to its Mailpit image.
// https://github.com/supabase/cli/pull/5660
function assertDisposableSmtpImage(image) {
  if (typeof image !== 'string' || !/^(?:(?:public\.ecr\.aws|ghcr\.io|docker\.io)\/)?supabase\/mailpit:v\d+\.\d+\.\d+(?:@sha256:[a-f0-9]{64})?$/.test(image)) {
    throw Error('Unexpected local SMTP image: ' + JSON.stringify(image));
  }
}
module.exports = { assertDisposableSmtpImage };
