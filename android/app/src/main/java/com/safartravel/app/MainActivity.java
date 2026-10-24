package com.safartravel.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.TextView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static final String BOOTED =
        "(function(){var r=document.getElementById('root');return !!(r&&r.getAttribute('data-booted')==='1');})()";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() == null || getBridge().getWebView() == null) return;

        WebView webView = getBridge().getWebView();
        webView.setBackgroundColor(Color.parseColor("#070b14"));

        TextView status = new TextView(this);
        status.setText("Safar");
        status.setTextColor(Color.parseColor("#1a140c"));
        status.setBackgroundColor(Color.parseColor("#e8c99a"));
        status.setGravity(Gravity.CENTER);
        status.setTextSize(28);
        addContentView(
            status,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        final boolean[] pageShown = { false };
        final int[] generation = { 0 };
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onReceivedError(WebView view) {
                if (pageShown[0]) return;
                status.post(() -> status.setText("Safar could not open its page on this phone."));
            }

            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                status.post(() -> {
                    status.setVisibility(View.VISIBLE);
                    status.setText("Safar’s page closed on this phone.");
                });
                return true;
            }

            @Override
            public void onPageLoaded(WebView view) {
                generation[0] += 1;
                awaitBoot(view, status, pageShown, generation, generation[0], 0);
            }
        });
    }

    private void awaitBoot(WebView webView, TextView status, boolean[] pageShown, int[] generation, int ticket, int attempt) {
        if (pageShown[0] || ticket != generation[0] || isFinishing()) return;
        webView.evaluateJavascript(BOOTED, value -> {
            if (pageShown[0] || ticket != generation[0] || isFinishing()) return;
            if ("true".equals(value)) {
                pageShown[0] = true;
                status.setVisibility(View.GONE);
                return;
            }
            if (attempt >= 40) {
                status.setText("Safar could not open its page on this phone.");
                return;
            }
            status.postDelayed(() -> awaitBoot(webView, status, pageShown, generation, ticket, attempt + 1), 250);
        });
    }
}
