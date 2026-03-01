import '../styles/globals.css'
import { ThemeProvider } from '../context/ThemeContext';
import { I18nProvider } from '../context/I18nContext';

function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <Component {...pageProps} />
      </I18nProvider>
    </ThemeProvider>
  )
}

export default App;
