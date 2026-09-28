import React, { useState } from 'react';
import {
  CreditCard,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  ShieldCheck,
  Zap,
  Globe,
  RefreshCw,
  Sliders,
  DollarSign,
  Building,
  Key,
  Lock,
} from 'lucide-react';
import { PaymentGatewaySettings, PaymentGatewayProvider } from '../types';
import {
  getPaymentGatewaySettings,
  savePaymentGatewaySettings,
  testPaymentGatewayConnection,
} from '../services/albumStorage';

interface IntegratePaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: (settings: PaymentGatewaySettings) => void;
}

export const IntegratePaymentGatewayModal: React.FC<IntegratePaymentGatewayModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'stripe' | 'sslcommerz' | 'rules'>('stripe');
  const [settings, setSettings] = useState<PaymentGatewaySettings>(() => getPaymentGatewaySettings());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    provider: PaymentGatewayProvider;
    success: boolean;
    message: string;
  } | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleTestConnection = (provider: PaymentGatewayProvider) => {
    setIsTesting(true);
    setTestResult(null);

    setTimeout(() => {
      const config = provider === 'stripe' ? settings.stripe : settings.sslcommerz;
      const res = testPaymentGatewayConnection(provider, config);
      setTestResult({
        provider,
        success: res.success,
        message: res.message,
      });
      setIsTesting(false);
    }, 600);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    savePaymentGatewaySettings(settings);
    setIsSaved(true);
    if (onSettingsSaved) {
      onSettingsSaved(settings);
    }
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  const isStripeActive = settings.stripe.enabled;
  const isSSLCommerzActive = settings.sslcommerz.enabled;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden relative my-8">
        {/* Modal Header */}
        <div className="p-6 border-b border-stone-800 bg-stone-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-amber-500/20 to-rose-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <CreditCard className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-100 flex items-center gap-2">
                <span>Integrate Payment Gateway</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Live & Sandbox Ready
                </span>
              </h3>
              <p className="text-xs text-stone-400">
                Link Stripe (Cards / Apple Pay) and SSLCommerz (bKash, Nagad, Internet Banking)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-850 hover:bg-stone-800 text-stone-400 hover:text-stone-200 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 pt-4 border-b border-stone-850 gap-2 bg-stone-950/40">
          <button
            type="button"
            onClick={() => {
              setActiveTab('stripe');
              setTestResult(null);
            }}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold transition flex items-center gap-2 border-b-2 -mb-px ${
              activeTab === 'stripe'
                ? 'border-indigo-500 text-indigo-300 bg-stone-900 shadow-xs'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span>Stripe (International & Cards)</span>
            {settings.stripe.enabled && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-indigo-500/20 text-indigo-300">
                {settings.stripe.mode.toUpperCase()}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('sslcommerz');
              setTestResult(null);
            }}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold transition flex items-center gap-2 border-b-2 -mb-px ${
              activeTab === 'sslcommerz'
                ? 'border-emerald-500 text-emerald-300 bg-stone-900 shadow-xs'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>SSLCommerz (Bangladesh)</span>
            {settings.sslcommerz.enabled && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-emerald-500/20 text-emerald-300">
                {settings.sslcommerz.mode.toUpperCase()}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('rules');
              setTestResult(null);
            }}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold transition flex items-center gap-2 border-b-2 -mb-px ${
              activeTab === 'rules'
                ? 'border-amber-500 text-amber-300 bg-stone-900 shadow-xs'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Checkout Rules</span>
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* TAB 1: STRIPE SETTINGS */}
          {activeTab === 'stripe' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-950/20 border border-indigo-900/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg">
                    S
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-100 flex items-center gap-2">
                      <span>Stripe Payment Processing</span>
                      <span className="text-[10px] text-indigo-300 font-mono">v2026.3</span>
                    </h4>
                    <p className="text-xs text-stone-400">
                      Accept Visa, Mastercard, American Express, and Apple Pay globally.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-stone-300 font-medium">Enable</span>
                  <input
                    type="checkbox"
                    checked={settings.stripe.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        stripe: { ...settings.stripe, enabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded-sm accent-indigo-500"
                  />
                </label>
              </div>

              {/* Environment Toggle: Test vs Live */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() =>
                    setSettings({
                      ...settings,
                      stripe: { ...settings.stripe, mode: 'test' },
                    })
                  }
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    settings.stripe.mode === 'test'
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                      : 'bg-stone-950/60 border-stone-850 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <p className="text-xs font-semibold">Test / Sandbox Mode</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Use pk_test_ and sk_test_ keys for risk-free orders</p>
                </div>

                <div
                  onClick={() =>
                    setSettings({
                      ...settings,
                      stripe: { ...settings.stripe, mode: 'live' },
                    })
                  }
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    settings.stripe.mode === 'live'
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                      : 'bg-stone-950/60 border-stone-850 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <p className="text-xs font-semibold">Live Production Mode</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Process real client payments via your Stripe merchant account</p>
                </div>
              </div>

              {/* Publishable Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Publishable API Key ({settings.stripe.mode === 'test' ? 'pk_test_...' : 'pk_live_...'})</span>
                  </span>
                  <a
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <span>Stripe Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </label>
                <input
                  type="text"
                  required
                  placeholder={settings.stripe.mode === 'test' ? 'pk_test_51...' : 'pk_live_51...'}
                  value={settings.stripe.publishableKey}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      stripe: { ...settings.stripe, publishableKey: e.target.value },
                    })
                  }
                  className="w-full bg-stone-950 border border-stone-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-stone-200 font-mono placeholder-stone-600 focus:outline-hidden"
                />
              </div>

              {/* Secret Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Secret API Key ({settings.stripe.mode === 'test' ? 'sk_test_...' : 'sk_live_...'})</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder={settings.stripe.mode === 'test' ? 'sk_test_51...' : 'sk_live_51...'}
                  value={settings.stripe.secretKey}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      stripe: { ...settings.stripe, secretKey: e.target.value },
                    })
                  }
                  className="w-full bg-stone-950 border border-stone-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-stone-200 font-mono placeholder-stone-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Currency */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-300">Default Currency</label>
                  <select
                    value={settings.stripe.currency}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        stripe: {
                          ...settings.stripe,
                          currency: e.target.value as any,
                        },
                      })
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="bdt">BDT (৳) - Bangladeshi Taka</option>
                    <option value="usd">USD ($) - US Dollars</option>
                    <option value="eur">EUR (€) - Euros</option>
                    <option value="gbp">GBP (£) - British Pounds</option>
                  </select>
                </div>

                {/* Statement Descriptor */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-300">Statement Descriptor</label>
                  <input
                    type="text"
                    value={settings.stripe.statementDescriptor || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        stripe: { ...settings.stripe, statementDescriptor: e.target.value },
                      })
                    }
                    placeholder="RAMYACHOBI STUDIO"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Test Connection Button */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleTestConnection('stripe')}
                  disabled={isTesting}
                  className="px-3.5 py-2 rounded-xl bg-stone-950 hover:bg-stone-850 border border-stone-800 text-indigo-400 hover:text-indigo-300 text-xs font-medium transition flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Validating Keys...' : 'Test Stripe Credentials'}</span>
                </button>

                <span className="text-[11px] text-stone-500 font-mono">
                  AES-256 Client-Side Enforced
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: SSLCOMMERZ SETTINGS */}
          {activeTab === 'sslcommerz' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
                    ৳
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-100 flex items-center gap-2">
                      <span>SSLCommerz Payment Gateway</span>
                      <span className="px-2 py-0.2 rounded-full text-[9px] font-mono bg-emerald-500/20 text-emerald-300">
                        BANGLADESH #1
                      </span>
                    </h4>
                    <p className="text-xs text-stone-400">
                      Process instant bKash, Nagad, Rocket, Visa, Mastercard, and Bank Transfers.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-stone-300 font-medium">Enable</span>
                  <input
                    type="checkbox"
                    checked={settings.sslcommerz.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        sslcommerz: { ...settings.sslcommerz, enabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded-sm accent-emerald-500"
                  />
                </label>
              </div>

              {/* Mode Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() =>
                    setSettings({
                      ...settings,
                      sslcommerz: { ...settings.sslcommerz, mode: 'sandbox' },
                    })
                  }
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    settings.sslcommerz.mode === 'sandbox'
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                      : 'bg-stone-950/60 border-stone-850 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <p className="text-xs font-semibold">Sandbox Test Environment</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Use sandbox.sslcommerz.com merchant credentials</p>
                </div>

                <div
                  onClick={() =>
                    setSettings({
                      ...settings,
                      sslcommerz: { ...settings.sslcommerz, mode: 'live' },
                    })
                  }
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    settings.sslcommerz.mode === 'live'
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                      : 'bg-stone-950/60 border-stone-850 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <p className="text-xs font-semibold">Live Production Gateway</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Real-time settlement to your verified merchant bank account</p>
                </div>
              </div>

              {/* Store ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-emerald-400" />
                    <span>SSLCommerz Store ID</span>
                  </span>
                  <a
                    href="https://merchant.sslcommerz.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <span>Merchant Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ramyachobi_studio_live"
                  value={settings.sslcommerz.storeId}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sslcommerz: { ...settings.sslcommerz, storeId: e.target.value },
                    })
                  }
                  className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-stone-200 font-mono placeholder-stone-600 focus:outline-hidden"
                />
              </div>

              {/* Store Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Store Password / Secret Key</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter Store Password"
                  value={settings.sslcommerz.storePassword}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sslcommerz: { ...settings.sslcommerz, storePassword: e.target.value },
                    })
                  }
                  className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-stone-200 font-mono placeholder-stone-600 focus:outline-hidden"
                />
              </div>

              {/* IPN Webhook URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-300 flex items-center justify-between">
                  <span>Instant Payment Notification (IPN) Webhook URL</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(settings.sslcommerz.ipnUrl || '', 'ipn')}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    {copiedField === 'ipn' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied IPN URL!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy IPN URL</span>
                      </>
                    )}
                  </button>
                </label>
                <input
                  type="text"
                  readOnly
                  value={settings.sslcommerz.ipnUrl || `${window.location.origin}/api/payment/sslcommerz-ipn`}
                  className="w-full bg-stone-950/70 border border-stone-850 rounded-xl px-3.5 py-2 text-xs text-stone-400 font-mono focus:outline-hidden"
                />
                <p className="text-[10px] text-stone-500">
                  Paste this IPN URL into your SSLCommerz Merchant Panel to receive automated webhook confirmations.
                </p>
              </div>

              {/* Test Connection Button */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleTestConnection('sslcommerz')}
                  disabled={isTesting}
                  className="px-3.5 py-2 rounded-xl bg-stone-950 hover:bg-stone-850 border border-stone-800 text-emerald-400 hover:text-emerald-300 text-xs font-medium transition flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Verifying Merchant...' : 'Test SSLCommerz Credentials'}</span>
                </button>

                <span className="text-[11px] text-stone-500 font-mono">
                  Supported: bKash, Nagad, Cards
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: CHECKOUT RULES & FALLBACKS */}
          {activeTab === 'rules' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-2xl bg-stone-950/60 border border-stone-800 space-y-4">
                <h4 className="text-xs font-semibold text-stone-200 uppercase tracking-wider font-mono">
                  Primary Client Checkout Gateway
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                      settings.activeGateway === 'all'
                        ? 'bg-amber-500/10 border-amber-500/50 text-stone-100'
                        : 'bg-stone-900/60 border-stone-850 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="activeGateway"
                      checked={settings.activeGateway === 'all'}
                      onChange={() => setSettings({ ...settings, activeGateway: 'all' })}
                      className="mt-0.5 accent-amber-500"
                    />
                    <div>
                      <p className="font-semibold text-stone-200">Both Stripe & SSLCommerz</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        Client can choose between International Credit Cards or Bangladeshi Mobile Banking.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                      settings.activeGateway === 'stripe'
                        ? 'bg-indigo-500/10 border-indigo-500/50 text-stone-100'
                        : 'bg-stone-900/60 border-stone-850 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="activeGateway"
                      checked={settings.activeGateway === 'stripe'}
                      onChange={() => setSettings({ ...settings, activeGateway: 'stripe' })}
                      className="mt-0.5 accent-indigo-500"
                    />
                    <div>
                      <p className="font-semibold text-stone-200">Stripe Only</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        Direct card checkout via Stripe for destination weddings & diaspora couples.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                      settings.activeGateway === 'sslcommerz'
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-stone-100'
                        : 'bg-stone-900/60 border-stone-850 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="activeGateway"
                      checked={settings.activeGateway === 'sslcommerz'}
                      onChange={() => setSettings({ ...settings, activeGateway: 'sslcommerz' })}
                      className="mt-0.5 accent-emerald-500"
                    />
                    <div>
                      <p className="font-semibold text-stone-200">SSLCommerz Only</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        Streamlined Bangladeshi gateway focusing on bKash, Nagad, and local bank cards.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                      settings.activeGateway === 'manual'
                        ? 'bg-stone-800 border-stone-700 text-stone-100'
                        : 'bg-stone-900/60 border-stone-850 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="activeGateway"
                      checked={settings.activeGateway === 'manual'}
                      onChange={() => setSettings({ ...settings, activeGateway: 'manual' })}
                      className="mt-0.5 accent-stone-400"
                    />
                    <div>
                      <p className="font-semibold text-stone-200">Manual TrxID Only</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        Client manually sends money to studio numbers and submits Transaction ID.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Manual Fallback Toggle */}
              <div className="p-4 rounded-2xl bg-stone-950/60 border border-stone-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-stone-200">
                    Allow Direct Manual bKash / Nagad / Rocket Fallback
                  </p>
                  <p className="text-[11px] text-stone-400">
                    If enabled, clients can still submit manual TrxID if their card or online checkout fails.
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowManualFallback}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        allowManualFallback: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded-sm accent-amber-500"
                  />
                  <span className="text-xs text-stone-300 font-medium">Enabled</span>
                </label>
              </div>
            </div>
          )}

          {/* Test Result Toast/Banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 animate-fade-in ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-semibold">
                  {testResult.success ? 'Gateway Verified' : 'Configuration Error'}
                </p>
                <p className="leading-relaxed opacity-90">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Bottom Action Bar */}
          <div className="pt-4 border-t border-stone-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>
                Active:{' '}
                <strong className="text-stone-200">
                  {settings.activeGateway === 'all'
                    ? 'Stripe & SSLCommerz'
                    : settings.activeGateway.toUpperCase()}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-stone-800 hover:bg-stone-800 text-stone-300 text-xs font-medium transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaved}
                className="px-5 py-2 rounded-xl bg-linear-to-r from-amber-500 to-rose-500 hover:opacity-95 text-stone-950 text-xs font-semibold transition flex items-center gap-1.5 shadow-lg shadow-amber-950/20"
              >
                {isSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Settings Saved!</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Save Gateway Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
