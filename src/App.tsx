import { useState } from 'react';
import { Download, Coffee, X, Smartphone } from 'lucide-react';

const reactNativeCode = `import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, StatusBar, BackHandler, Platform, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';

const CLEANTUBE_JS = \`
  (function() {
    try {
      // 1. Inject CSS to hide Shorts, the Shorts bottom button, and visual Ads
      const style = document.createElement('style');
    style.textContent = \\\`
      /* Hide Shorts */
      ytm-reel-shelf-renderer,
      ytm-rich-section-renderer,
      ytm-pivot-bar-renderer ytm-pivot-bar-item-renderer:nth-child(2) { display: none !important; }
    \\\`;
    document.head.appendChild(style);

    // --- 2. MutationObserver for Player UI & Ad Skipping ---
    const handleMutations = () => {
      // Instantly click "Skip Ad" if it exists
      const skipButtons = document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-text.ytp-ad-skip-button-text, .ytm-skip-ad-button, button[class*="skip-ad"], .skip-ad-button, [id*="skip-button"]');
      if (skipButtons.length > 0) {
          skipButtons.forEach(btn => btn.click());
      }

      // Bypass unskippable video ads by jumping to the end
      const isAdShowing = document.querySelector('.ad-showing, .ad-playing, .ytp-ad-player-overlay, .ytm-ad-badge, ytm-promoted-video-renderer, ytm-companion-ad-renderer, .ytm-companion-slot');
      const videoElement = document.querySelector('video');
      if (isAdShowing && videoElement && videoElement.duration) {
          videoElement.playbackRate = 16;
          videoElement.muted = true;
          if (videoElement.currentTime < videoElement.duration - 0.5) {
              videoElement.currentTime = videoElement.duration - 0.1;
          }
      }

      // Force Fullscreen button to be enabled (YouTube might disable it if it thinks fullscreen isn't supported)
      document.querySelectorAll('.ytp-fullscreen-button, .ytm-fullscreen-button, button[aria-label*="ull screen"], button[aria-label*="ullscreen"], .fullscreen-icon').forEach(btn => {
          const targetBtn = btn.tagName === 'BUTTON' ? btn : btn.closest('button');
          if (targetBtn) {
              if (targetBtn.hasAttribute('disabled')) targetBtn.removeAttribute('disabled');
              if (targetBtn.hasAttribute('aria-disabled')) targetBtn.setAttribute('aria-disabled', 'false');
              targetBtn.style.pointerEvents = 'auto';
              targetBtn.style.opacity = '1';
          }
      });
    };

    const observer = new MutationObserver(handleMutations);
    observer.observe(document.body, { childList: true, subtree: true });
   
    // Initial run
    handleMutations();

    // --- 3. Intercept direct Shorts clicks and force normal player ---
    const interceptEvents = function(e) {
      if (!e.target || !e.target.closest) return;

      const link = e.target.closest('a');
      if (link && link.href && link.href.includes('/shorts/')) {
        e.preventDefault();
        e.stopPropagation();
        const videoId = link.href.split('/shorts/')[1].split('?')[0];
        window.location.href = '/watch?v=' + videoId;
        return;
      }
    };
   
    document.addEventListener('click', interceptEvents, true);
    document.addEventListener('touchstart', interceptEvents, true);
    document.addEventListener('touchend', interceptEvents, true);

    // --- 4. Sync Fullscreen State with React Native ---
    document.addEventListener('fullscreenchange', () => {
        window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'NATIVE_FULLSCREEN_CHANGE',
            isFull: !!document.fullscreenElement
        }));
    });
    document.addEventListener('webkitfullscreenchange', () => {
        window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'NATIVE_FULLSCREEN_CHANGE',
            isFull: !!document.webkitFullscreenElement
        }));
    });
   
    } catch (err) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: err.message || String(err) }));
    }
  })();
  true;
\`;

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const backAction = () => {
        if (isFullscreen) {
          // Exiting fullscreen via back button
          setIsFullscreen(false);
          ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
          // Send message to WebView to exit native fullscreen
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(\`
              if (document.fullscreenElement) {
                  document.exitFullscreen();
              } else if (document.webkitFullscreenElement) {
                  document.webkitExitFullscreen();
              }
              true;
            \`);
          }
          return true;
        }
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction
      );

      return () => backHandler.remove();
    }
  }, [canGoBack, isFullscreen]);

  const onMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ERROR') {
        console.error("WEBVIEW INJECTION ERROR:", data.message);
      } else if (data.type === 'NATIVE_FULLSCREEN_CHANGE') {
        setIsFullscreen(data.isFull);
        if (data.isFull) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
        }
      }
    } catch (e) {
      // Ignore
    }
  };

  return (
    <SafeAreaView
      style={isFullscreen ? styles.fullscreenContainer : styles.container}
      edges={isFullscreen ? [] : ['top', 'left', 'right']}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden={isFullscreen} barStyle="light-content" backgroundColor="#000" />
     
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://m.youtube.com' }}
        allowsFullscreenVideo={true} // Use Android's perfect native fullscreen support!
        pullToRefreshEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        onMessage={onMessage}
        injectedJavaScript={CLEANTUBE_JS}
        // This UserAgent string tricks Google into allowing you to Sign In!
        userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36"
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
         
          if (navState.url.includes('/shorts/')) {
            webViewRef.current?.injectJavaScript(\`window.location.href = 'https://m.youtube.com'; true;\`);
          }
        }}
        style={styles.webview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});`;

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDonateModalOpen, setIsDonateModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-neutral-300 font-sans selection:bg-neutral-800 selection:text-white">
      {/* Hero Section */}
      <header className="relative z-10 container mx-auto px-4 pt-16 pb-12 md:px-6 md:pt-32 md:pb-24 flex flex-col items-center text-center">
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-4 md:mb-6">
          Take Back Your Attention
        </h1>
        
        <p className="text-base sm:text-lg md:text-xl text-neutral-400 max-w-2xl mb-10 md:mb-12 leading-relaxed px-2">
          CleanTube is a completely distraction-free, ad-free wrapper that actively hides Shorts and video ads. Focus on what you want to watch.
        </p>

        {/* Interactive Mockup */}
        <div 
          className="relative group cursor-pointer transition-transform duration-300 hover:-translate-y-2"
          onClick={() => setIsModalOpen(true)}
        >
          <div className="relative bg-black border border-neutral-800 rounded-[2.5rem] w-64 h-[540px] sm:w-72 sm:h-[600px] overflow-hidden shadow-xl flex flex-col items-center justify-center">
            {/* Phone Notch */}
            <div className="absolute top-0 w-32 h-6 bg-neutral-900 rounded-b-3xl z-20" />
            
            {/* Mockup Screen Content */}
            <div className="absolute inset-0 bg-black flex flex-col z-10">
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-6">
                 <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center border border-neutral-800">
                   <Smartphone size={32} className="text-white" />
                 </div>
                 <div>
                   <h3 className="text-2xl font-bold text-white mb-2">CleanTube</h3>
                   <p className="text-sm text-neutral-400">Zero Ads. Zero Shorts.<br/>100% Focus.</p>
                 </div>
                 
                 <div className="mt-4 px-6 py-3 rounded-full bg-white text-black font-medium text-sm flex items-center gap-2 hover:bg-neutral-200 transition-colors duration-300">
                    <Download size={16} />
                    Click to Download
                 </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* DIY Guide Section */}
      <section className="relative z-10 container mx-auto px-4 sm:px-6 py-16 md:py-24 border-t border-neutral-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 md:mb-6">DIY: How to Build It</h2>
            <p className="text-base md:text-lg text-neutral-400">Don't want to use our pre-built APK? You can build it yourself in the cloud using Expo Application Services (EAS). No Android Studio required.</p>
          </div>

          <div className="space-y-12">
            {/* Step 1 */}
            <div className="bg-black rounded-3xl border border-neutral-800 overflow-hidden">
              <div className="p-6 md:p-8 border-b border-neutral-800">
                <h3 className="text-2xl font-bold text-white mb-4">Step 1: The React Native Shell</h3>
                <p className="text-neutral-400 leading-relaxed mb-6">Create a fresh Expo project and install the necessary dependencies that allow the app to act as a web browser and control device orientation.</p>
                <div className="bg-neutral-900 rounded-xl p-4 overflow-x-auto">
                  <pre className="text-sm text-neutral-300 font-mono">
<code>{`npx create-expo-app@latest cleantube
cd cleantube
npx expo install react-native-webview expo-screen-orientation react-native-safe-area-context`}</code>
                  </pre>
                </div>
              </div>
              <div className="p-6 md:p-8 bg-neutral-950">
                <p className="text-neutral-400 leading-relaxed mb-6">Before building, configure your <code className="text-white bg-neutral-800 px-1.5 py-0.5 rounded">app.json</code> package name and icon settings. Place a square icon.png (1024x1024) in your assets folder.</p>
                <div className="bg-neutral-900 rounded-xl p-4 overflow-x-auto">
                  <pre className="text-sm text-neutral-300 font-mono">
<code>{`{
  "expo": {
    "name": "CleanTube",
    "slug": "cleantube",
    "version": "1.0.0",
    "icon": "./assets/icon.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon.png",
        "backgroundColor": "#ff0000"
      },
      "package": "com.yourname.cleantube"
    }
  }
}`}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-black rounded-3xl border border-neutral-800 overflow-hidden">
              <div className="p-6 md:p-8">
                <h3 className="text-2xl font-bold text-white mb-4">Step 2: The JavaScript Assassin</h3>
                <p className="text-neutral-400 leading-relaxed mb-6">This is the magic. Replace the contents of your <code className="text-white bg-neutral-800 px-1.5 py-0.5 rounded">src/app/index.tsx</code> (or <code className="text-white bg-neutral-800 px-1.5 py-0.5 rounded">App.tsx</code>) with this code. It injects custom JavaScript to strip out ads and Shorts.</p>
                <div className="bg-neutral-900 rounded-xl p-4 overflow-x-auto max-h-[500px]">
                  <pre className="text-sm text-neutral-300 font-mono">
<code>{reactNativeCode}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-black rounded-3xl border border-neutral-800 overflow-hidden">
              <div className="p-6 md:p-8 border-b border-neutral-800">
                <h3 className="text-2xl font-bold text-white mb-4">Step 3: Compiling the APK</h3>
                <p className="text-neutral-400 leading-relaxed mb-6">Install Expo's EAS CLI globally and log in. Then configure your cloud build settings.</p>
                <div className="bg-neutral-900 rounded-xl p-4 overflow-x-auto">
                  <pre className="text-sm text-neutral-300 font-mono">
<code>{`npm install -g eas-cli
eas login
eas build:configure`}</code>
                  </pre>
                </div>
              </div>
              <div className="p-6 md:p-8 bg-neutral-950">
                <p className="text-neutral-400 leading-relaxed mb-6">Update the newly generated <code className="text-white bg-neutral-800 px-1.5 py-0.5 rounded">eas.json</code> file to build an APK instead of an AAB for direct distribution.</p>
                <div className="bg-neutral-900 rounded-xl p-4 overflow-x-auto mb-6">
                  <pre className="text-sm text-neutral-300 font-mono">
<code>{`{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}`}</code>
                  </pre>
                </div>
                <p className="text-neutral-400 leading-relaxed mb-6">Finally, send the app to the build queue!</p>
                <div className="bg-neutral-900 rounded-xl p-4 overflow-x-auto">
                  <pre className="text-sm text-neutral-300 font-mono">
<code>eas build -p android --profile preview</code>
                  </pre>
                </div>
                <div className="mt-6 p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
                  <ul className="text-sm text-neutral-400 space-y-2 list-disc list-inside">
                    <li>EAS will ask if you want to generate a new Android Keystore. Press <strong>Y (Yes)</strong>.</li>
                    <li>The terminal will upload your project and provide a URL to watch the build progress.</li>
                    <li>Once finished (usually 10-15 minutes), you'll get a direct download link for your <strong className="text-neutral-200">CleanTube.apk</strong>!</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-neutral-900 bg-black py-12">
        <div className="container mx-auto px-6 text-center">
          <p className="text-neutral-500 text-sm max-w-2xl mx-auto">
            Disclaimer: CleanTube is an independent, open-source educational project. It is not affiliated, associated, authorized, endorsed by, or in any way officially connected with Google LLC, YouTube, or any of its subsidiaries or its affiliates.
          </p>
          <p className="text-neutral-600 text-sm mt-4">
            &copy; {new Date().getFullYear()} CleanTube. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Download & Donate Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsModalOpen(false)}
          />
          
          <div className="relative w-full max-w-md bg-black border border-neutral-800 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            {/* Modal close button */}
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-neutral-400 hover:text-white transition-colors p-2 rounded-full hover:bg-neutral-900"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center mt-4">
              <div className="w-16 h-16 bg-neutral-900 rounded-2xl flex items-center justify-center mb-6 border border-neutral-800">
                <Download size={32} className="text-white" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">Get CleanTube</h2>
              <p className="text-neutral-400 mb-8">
                Download the latest APK for your Android device or support the development.
              </p>

              <div className="flex flex-col w-full gap-4">
                <a 
                  href="https://github.com/normie-6923/ytshortblockerdistribution/releases/download/v1.0.0/app-release.apk"
                  className="flex items-center justify-center gap-3 w-full bg-white text-black hover:bg-neutral-200 font-medium py-4 px-6 rounded-2xl transition-all duration-300 hover:-translate-y-1"
                >
                  <Download size={20} />
                  Download APK
                </a>
                
                <button 
                  onClick={() => setIsDonateModalOpen(true)}
                  className="flex items-center justify-center gap-3 w-full bg-neutral-900 hover:bg-neutral-800 text-white font-medium py-4 px-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 border border-neutral-800"
                >
                  <Coffee size={20} className="text-white" />
                  Buy me a Coffee
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Donate Modal */}
      {isDonateModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsDonateModalOpen(false)}
          />
          
          <div className="relative w-full max-w-md bg-black border border-neutral-800 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            {/* Modal close button */}
            <button 
              onClick={() => setIsDonateModalOpen(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-neutral-400 hover:text-white transition-colors p-2 rounded-full hover:bg-neutral-900"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center mt-4">
              <div className="w-16 h-16 bg-neutral-900 rounded-2xl flex items-center justify-center mb-6 border border-neutral-800">
                <Coffee size={32} className="text-white" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">Support CleanTube</h2>
              <p className="text-neutral-400 mb-6">
                Scan with any UPI App (GPay, PhonePe, Paytm) to support the project!
              </p>

              <div className="flex flex-col items-center relative w-full">
                <div className="bg-white p-4 rounded-2xl mb-1 shadow-inner relative z-10">
                  <img 
                    src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi%3A%2F%2Fpay%3Fpa%3Dpaytm.s36o6vz%40pty%26pn%3DCleanTube%2520Developer%26cu%3DINR" 
                    alt="UPI QR Code" 
                    className="mx-auto rounded-lg w-[160px] h-[160px] sm:w-[200px] sm:h-[200px]" 
                  />
                </div>

                {/* Click Here Arrow */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 pointer-events-none animate-bounce -mt-3 relative z-20">
                  <img 
                    src="/clickhere.png" 
                    alt="Scan here" 
                    className="w-full h-full object-contain -rotate-12"
                  />
                </div>

                {/* Tips for phone users */}
                <div 
                  className="mt-1 text-[13px] text-neutral-300 md:hidden leading-relaxed text-center px-2" 
                  style={{ fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', cursive" }}
                >
                  *Tips: If on phone, take a screenshot, open your payment app, click on scan and upload the image from your gallery.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
