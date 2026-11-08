// Extends app.json. Plain-HTTP traffic is allowed only in builds whose API address is http:// (local development);
// a release build pointing at https:// refuses cleartext, which Google Play expects.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    usesCleartextTraffic: String(process.env.EXPO_PUBLIC_API_BASE_URL || '').startsWith('http://'),
  },
});
