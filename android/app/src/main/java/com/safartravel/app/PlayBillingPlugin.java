package com.safartravel.app;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin {
    private static final List<String> PRODUCT_IDS = List.of("safar_monthly", "safar_yearly");

    private BillingClient billingClient;
    private PluginCall pendingPurchase;

    private final PurchasesUpdatedListener purchasesUpdatedListener = (billingResult, purchases) -> {
        PluginCall call = pendingPurchase;
        pendingPurchase = null;
        if (call == null) return;
        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            call.reject("Purchase canceled.");
            return;
        }
        if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
            call.reject("Purchase could not be completed.");
            return;
        }
        Purchase purchase = purchases.get(0);
        acknowledge(purchase);
        JSObject ret = new JSObject();
        List<String> products = purchase.getProducts();
        ret.put("productId", products.isEmpty() ? "" : products.get(0));
        ret.put("purchaseToken", purchase.getPurchaseToken());
        call.resolve(ret);
    };

    @PluginMethod
    public void products(PluginCall call) {
        connect(call, () -> queryProducts(call));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId", "");
        if (!PRODUCT_IDS.contains(productId)) {
            call.reject("Unknown plan.");
            return;
        }
        if (pendingPurchase != null) {
            call.reject("A purchase is already in progress.");
            return;
        }
        pendingPurchase = call;
        connect(call, () -> launchPurchase(call, productId));
    }

    private void connect(PluginCall call, Runnable next) {
        if (billingClient != null && billingClient.isReady()) {
            next.run();
            return;
        }
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(purchasesUpdatedListener)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build();
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    next.run();
                    return;
                }
                fail(call, "Google Play billing is not available on this phone.");
            }

            @Override
            public void onBillingServiceDisconnected() {
            }
        });
    }

    private void queryProducts(PluginCall call) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String id : PRODUCT_IDS) {
            products.add(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()
            );
        }
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(products).build();
        billingClient.queryProductDetailsAsync(params, (billingResult, result) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                call.reject("Could not load subscription prices.");
                return;
            }
            JSObject payload = new JSObject();
            com.getcapacitor.JSArray list = new com.getcapacitor.JSArray();
            List<ProductDetails> details = result.getProductDetailsList();
            if (details != null) {
                for (ProductDetails item : details) {
                    ProductDetails.SubscriptionOfferDetails offer = baseOffer(item);
                    if (offer == null) continue;
                    List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
                    if (phases == null || phases.isEmpty()) continue;
                    JSObject row = new JSObject();
                    row.put("productId", item.getProductId());
                    row.put("title", item.getTitle());
                    row.put("price", phases.get(0).getFormattedPrice());
                    list.put(row);
                }
            }
            payload.put("products", list);
            call.resolve(payload);
        });
    }

    private void launchPurchase(PluginCall call, String productId) {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()
            ))
            .build();
        billingClient.queryProductDetailsAsync(params, (billingResult, result) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                fail(call, "Could not load this plan.");
                return;
            }
            List<ProductDetails> details = result.getProductDetailsList();
            if (details == null || details.isEmpty()) {
                fail(call, "This plan is not available in Google Play yet.");
                return;
            }
            ProductDetails item = details.get(0);
            ProductDetails.SubscriptionOfferDetails offer = baseOffer(item);
            if (offer == null) {
                fail(call, "This plan has no price in Google Play.");
                return;
            }
            BillingFlowParams flow = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(item)
                        .setOfferToken(offer.getOfferToken())
                        .build()
                ))
                .build();
            getActivity().runOnUiThread(() -> {
                BillingResult launched = billingClient.launchBillingFlow(getActivity(), flow);
                if (launched.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    fail(call, "Google Play could not open the payment sheet.");
                }
            });
        });
    }

    private ProductDetails.SubscriptionOfferDetails baseOffer(ProductDetails item) {
        List<ProductDetails.SubscriptionOfferDetails> offers = item.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;
        for (ProductDetails.SubscriptionOfferDetails offer : offers) {
            if (offer.getOfferId() == null) return offer;
        }
        return offers.get(0);
    }

    private void acknowledge(Purchase purchase) {
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED || purchase.isAcknowledged()) return;
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();
        billingClient.acknowledgePurchase(params, billingResult -> {
        });
    }

    private void fail(PluginCall call, String message) {
        if (pendingPurchase == call) pendingPurchase = null;
        call.reject(message);
    }
}
