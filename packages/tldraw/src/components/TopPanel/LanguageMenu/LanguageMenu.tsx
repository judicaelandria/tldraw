import * as React from 'react'
import { ExternalLinkIcon } from '@radix-ui/react-icons'
import { FormattedMessage, useIntl } from 'react-intl'
import { DMCheckboxItem, DMDivider, DMItem, DMSubMenu } from '~components/Primitives/DropdownMenu'
import { SmallIcon } from '~components/Primitives/SmallIcon'
import { useTldrawApp } from '~hooks'
import { TDLanguage, TRANSLATIONS } from '~translations'
import { TDSnapshot } from '~types'
import { styled } from '~styles'

const languageSelector = (s: TDSnapshot) => s.settings.language

export function LanguageMenu() {
  const app = useTldrawApp()
  const language = app.useStore(languageSelector)
  const intl = useIntl()

  const handleChangeLanguage = React.useCallback(
    (locale: TDLanguage) => {
      app.setSetting('language', locale)
    },
    [app]
  )

  return (
    <Container>
      {TRANSLATIONS.map(({ locale, label }) => (
        <DMCheckboxItem
          key={locale}
          checked={language === locale}
          onCheckedChange={() => handleChangeLanguage(locale)}
          id={`TD-MenuItem-Language-${locale}`}
        >
          {label}
        </DMCheckboxItem>
      ))}
      <DMDivider />
      <a
        href="https://github.com/tldraw/tldraw/blob/develop/guides/translation.md"
        target="_blank"
        rel="nofollow"
      >
        <DMItem id="TD-MenuItem-Translation-Link">
          <FormattedMessage id="translation.link" />
          <SmallIcon>
            <ExternalLinkIcon />
          </SmallIcon>
        </DMItem>
      </a>
    </Container>
  )
}

const Container = styled('div', {
  maxHeight: 400,
  overflowY: 'auto',
  width: 'min-content',
  minWidth: 160,
})
