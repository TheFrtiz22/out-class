// Supabase CLI's official mirror order; never accept an arbitrary test container.
function assertMailpitImage(image) {
  if (!/^(?:(?:public\.ecr\.aws|ghcr\.io)\/supabase\/mailpit|(?:docker\.io\/)?(?:axllent|supabase)\/mailpit):v\d+\.\d+\.\d+(?:@sha256:[a-f0-9]{64})?$/.test(image)) throw Error('Unexpected local SMTP image');
}
module.exports = { assertMailpitImage };
