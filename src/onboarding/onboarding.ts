import './onboarding.css'

const logoIcon = document.getElementById('logo-icon') as HTMLImageElement
logoIcon.src = chrome.runtime.getURL('icons/foilguard-128.png')

document.getElementById('btn-options')!.addEventListener('click', () => {
  chrome.runtime.openOptionsPage()
})
