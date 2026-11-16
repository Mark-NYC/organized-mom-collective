import Capacitor
import UIKit
import WebKit

/// Serves the Astro site's folder pages from the app bundle (docs/ios/OMC_APP_ROADMAP.md → 2.1).
///
/// Capacitor's default router treats every extension-less path as a single-page-app route and returns the root
/// index.html. Astro builds one folder per page (`app/cleaning/index.html`), so `/app/cleaning` must load that
/// file. Unknown paths fall back to the root index.html, which opens Today (`/app`). Paths can't leave the bundle.
struct OMCRouter: Router {
    var basePath: String = ""

    func route(for path: String) -> String {
        let resolved = resolve(path)
        #if DEBUG
        NSLog("OMCRouter %@ -> %@ (base %@)", path, resolved, basePath)
        #endif
        return resolved
    }

    private func resolve(_ path: String) -> String {
        let fallback = basePath + "/index.html"
        let url = URL(fileURLWithPath: path)
        guard url.pathExtension.isEmpty else { return contained(basePath + path) ?? fallback }
        var trimmed = path
        while trimmed.count > 1 && trimmed.hasSuffix("/") { trimmed.removeLast() }
        if trimmed == "/" || trimmed.isEmpty { return fallback }
        let page = basePath + trimmed + "/index.html"
        if contained(page) != nil, FileManager.default.fileExists(atPath: page) {
            return page
        }
        return fallback
    }

    /// The path, if it stays inside the bundled web folder (no `..` escapes); nil otherwise.
    private func contained(_ candidate: String) -> String? {
        let resolved = URL(fileURLWithPath: candidate).standardizedFileURL.path
        let root = URL(fileURLWithPath: basePath).standardizedFileURL.path
        return resolved == root || resolved.hasPrefix(root + "/") ? candidate : nil
    }
}

/// The app's only view controller: Capacitor's bridge with the folder-page router.
class OMCBridgeViewController: CAPBridgeViewController {
    override open func router() -> Router {
        OMCRouter()
    }

    #if DEBUG
    /// Simulator test only (ios/App/AppUITests): `-OMCResetWebStorageForTesting` wipes the web view's own storage, the
    /// way iOS can under storage pressure. The page must come back from the native copy
    /// (src/lib/native/durable-storage.ts). Compiled out of Release builds.
    ///
    /// The wipe finishes BEFORE the web view exists, so the app loads once, against already-empty storage. It used to
    /// start after the first page load had begun and then call `reload()`: depending on which finished first, the
    /// reload hit a web view with nothing loaded yet (a blank app), or restarted a half-loaded page that the page's
    /// own restore then reloaded again (three loads; on a slow CI simulator, past the test's wait). That race, not
    /// the app, was the intermittent "Not found: Today" (runs 43745562656, 43771254277, 43771126012).
    override open func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        if ProcessInfo.processInfo.arguments.contains("-OMCResetWebStorageForTesting") {
            var done = false
            WKWebsiteDataStore.default().removeData(
                ofTypes: [WKWebsiteDataTypeLocalStorage, WKWebsiteDataTypeSessionStorage, WKWebsiteDataTypeIndexedDBDatabases],
                modifiedSince: .distantPast
            ) { done = true }
            // The completion handler runs on the main queue: keep the run loop turning until it has (10 s at most).
            let deadline = Date().addingTimeInterval(10)
            while !done && Date() < deadline { RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.05)) }
            NSLog("OMCTest web storage wiped before the first load (finished: %@)", done ? "yes" : "NO, timed out")
        }
        return super.webViewConfiguration(for: instanceConfiguration)
    }
    #endif
}
