import { compile } from 'handlebars'
import mjml2html from 'mjml'
import fs from 'fs'
import path from 'path'

function getEmailTemplateData<T>(templatePath: string): (data: T) => string {
  const config = {
    "beautify": false,
    "fonts": {
      "Roboto": "https://fonts.googleapis.com/css?family=Roboto"
    }
  }

  const fullPath = path.join(__dirname, 'templates/' + templatePath)
  return (data) => {
    const mjmlXml = compile<T>(fs.readFileSync(fullPath).toString());
    const { html } = mjml2html(mjmlXml(data), config);
    return html
  }
}

// type aliases for template data
type RegisterEmailTemplateData = {
  link: string
  linkExpiryDate: string
  appName: string
}

type ChannelExcludedEmailTemplateData = {
  link: string
  appName: string
  userName: string
  channelId: string
}

// function exports
export const registerEmailContent: (data: RegisterEmailTemplateData) => string = getEmailTemplateData('register.xml.mst')
export const channelExcludedEmailContent: (data: ChannelExcludedEmailTemplateData) => string = getEmailTemplateData('channelExcludedFromApp.xml.mst')

