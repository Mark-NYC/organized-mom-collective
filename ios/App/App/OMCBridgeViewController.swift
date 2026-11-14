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
        let fallback = basePath + "/index.html"
        let url = URL(fileURLWithPath: path)
        guard url.pathExtension.isEmpty else { return contained(basePath + path) ?? fallback }
        var trimmed = path
        while trimmed.count > 1 && trimmed.hasSuffix("/") { trimmed.removeLast() }
        if trimmed == "/" || trimmed.isEmpty { return fallback }
        if let page = contained(basePath + trimmed + "/index.html"), FileManager.default.fileExists(atPath: page) {
            return page
        }
        return fallback
    }

    /// The standardized file path, or nil if it points outside the bundled web folder.
    private func contained(_ candidate: String) -> String? {
        let resolved = URL(fileURLWithPath: candidate).standardizedFileURL.path
        let root = URL(fileURLWithPath: basePath).standardizedFileURL.path
        return resolved == root || resolved.hasPrefix(root + "/") ? resolved : nil
    }
}

/// The app's only view controller: Capacitor's bridge with the folder-page router.
class OMCBridgeViewController: CAPBridgeViewController {
    override open func router() -> Router {
        OMCRouter()
    }

    #if DEBUG
    /// Simulator test only (ios/App/AppUITests): `-OMCResetWebStorageForTesting` wipes the web view's own storage, the
    /// way iOS can under storage pressure, then reloads. The page must come back from the native copy
    /// (src/lib/native/durable-storage.ts). Compiled out of Release builds.
    override open func viewDidLoad() {
        super.viewDidLoad()
        guard ProcessInfo.processInfo.arguments.contains("-OMCResetWebStorageForTesting") else { return }
        WKWebsiteDataStore.default().removeData(
            ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
            modifiedSince: .distantPast
        ) { [weak self] in
            self?.webView?.reload()
        }
    }
    #endif
}
