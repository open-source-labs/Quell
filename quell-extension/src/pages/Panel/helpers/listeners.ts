import { CardHeaderPropsWithComponent } from "@material-ui/core"

export const handleRequestFinished = (
  callback: (e: chrome.devtools.network.Request) => void
) => {
  chrome.devtools.network.onRequestFinished.addListener(callback)
  return () => {
    chrome.devtools.network.onRequestFinished.removeListener(callback)
  }
}

export const handleNavigate = (callback: (e: chrome.devtools.network.Request) => void) => {
  chrome.devtools.network.onNavigated.addListener(callback)
  return () => {
    chrome.devtools.network.onNavigated.removeListener(callback)
  }
}