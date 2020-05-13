
var EM = {};
module.exports = EM;

EM.client = require('mailgun-js');

EM.dispatchResetPasswordLink = function(account, callback)
{
  const data = {
		from: process.env.NL_EMAIL_FROM || 'Node Login <do-not-reply@gmail.com>',
		to: account.email,
		subject: 'Password Reset',
		html: EM.composeEmail(account)
  };

  EM.client({
		apiKey: process.env.MAILGUN_API_KEY || '1234',
		domain: process.env.MAILGUN_DOMAIN || ''
  })
		.messages()
		.send(data, callback);
}

EM.composeEmail = function(o)
{
  let baseurl = process.env.NL_SITE_URL || 'http://localhost:3000';
  var html = "<html><body>";
    html += "Hi "+o.name+",<br><br>";
    html += "Your username is <b>"+o.user+"</b><br><br>";
    html += "<a href='"+baseurl+'/reset-password?key='+o.passKey+"'>Click here to reset your password</a><br><br>";
    html += "</body></html>";
  return html;
}