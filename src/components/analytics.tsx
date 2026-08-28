import Script from "next/script";

/**
 * Loads Google Tag Manager, and only when a container id is configured. With
 * the variable empty, which is how it ships today, nothing is requested and no
 * cookie is set, so the page stays free of third party code until someone
 * decides otherwise.
 *
 * GTM is the single entry point on purpose: GA4, Google Ads conversions and
 * anything else are configured inside the container rather than added here.
 */
export function Analytics() {
  const containerId = process.env.NEXT_PUBLIC_GTM_ID;
  if (!containerId) return null;

  return (
    <Script id="gtm" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${containerId}');`}
    </Script>
  );
}
