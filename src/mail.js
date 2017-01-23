import mailgunConstructor from 'mailgun-js'
import templates from './templates'
import mustache from 'mustache'
import log from './log'
import marked from 'marked'
import htmlToText from 'html-to-text'

const MailgunSingleton = mailgunConstructor({
  apiKey: process.env.MAILGUN_KEY,
  domain: process.env.MAILGUN_DOMAIN
})

const DefaultSender = `${process.env.SIGNUP_SENDER_NAME} <${process.env.SIGNUP_SENDER_EMAIL}>`

class Mail {
  async sendEmail(data) {
    return await MailgunSingleton.messages().send(data)
  }

  async sendEmailTemplate(to, subject, template, bindings = {}) {
    const data = templates[template]
    if (!data) {
      log.error(`Tried to send email with missing template data: ${template}`)
      return null
    }
    const renderedTemplateHTML = marked(mustache.render(data, bindings))
    const renderedTemplateText = htmlToText.fromString(renderedTemplateHTML, {
      wordwrap: 130
    })

    try {
      return this.sendEmail({
        from: DefaultSender,
        to,
        subject,
        html: renderedTemplateHTML,
        text: renderedTemplateText
      })
    } catch (ex) {
      log.error(ex)
      return null
    }
  }
}

export default new Mail()
