import React from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ChevronLeft, AlertTriangle } from 'lucide-react';

/**
 * Terms, Privacy and Refunds.
 *
 * These are plain-language drafts so the links are not dead and users can see
 * the rules they are agreeing to. They have NOT been reviewed by a lawyer, and
 * this app takes payments — get them checked before launch.
 */

const UPDATED = 'September 2026';

interface Doc {
  title: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
}

const DOCS: Record<string, Doc> = {
  terms: {
    title: 'Terms of Service',
    intro:
      'These terms cover your use of BeatBiddr. By signing in you agree to them.',
    sections: [
      {
        heading: 'What BeatBiddr does',
        body: [
          'BeatBiddr lets you request songs from DJs playing live at a venue and add a tip to your request. A tip increases the chance and the speed of your song being played.',
          'A tip is a request, not a purchase. DJs choose what to play. Accepting a request is always their decision.',
        ],
      },
      {
        heading: 'Your account',
        body: [
          'You need a Google account to sign in. One account holds one role — either Music Fan or DJ — and the role cannot be changed later. To use BeatBiddr the other way, delete your account and sign up again.',
          'You are responsible for activity on your account. Keep your Google sign-in secure.',
        ],
      },
      {
        heading: 'Your wallet',
        body: [
          'Funds you add are held as a balance for requesting songs on BeatBiddr. The balance is not a bank account, earns no interest, and cannot be transferred to another person.',
          'Top-ups are limited to $1–$1,000 at a time. Your balance is not redeemable for cash except where the law requires it.',
        ],
      },
      {
        heading: 'DJ accounts',
        body: [
          'DJs must give accurate identity and contact details. Usernames are permanent and must not impersonate anyone else.',
          'We may suspend or remove accounts that provide false information or misuse the service.',
        ],
      },
      {
        heading: 'Acceptable use',
        body: [
          'Do not use BeatBiddr to harass anyone, to send abusive messages to DJs, or to attempt to interfere with the service or other users’ accounts.',
          'We may suspend accounts that break these rules.',
        ],
      },
      {
        heading: 'Availability and changes',
        body: [
          'BeatBiddr is provided as-is. We do not guarantee it will be available without interruption, and features may change.',
          'We may update these terms. Continuing to use BeatBiddr after a change means you accept the updated terms.',
        ],
      },
      {
        heading: 'Contact',
        body: ['Questions about these terms can be sent to the contact address on our website.'],
      },
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    intro: 'What we collect, why, and what we do with it.',
    sections: [
      {
        heading: 'What we collect',
        body: [
          'From your Google sign-in: your name, email address and profile photo.',
          'If you are a DJ: your stage name, legal name, phone number, address and optionally your venue. We ask for these so fans know who they are tipping and so we can verify real DJs.',
          'Your activity: song requests, tip amounts, messages to DJs, and your wallet transaction history.',
          'If you connect Spotify: read-only access to search and to your playlists. We never post anything to your Spotify account.',
        ],
      },
      {
        heading: 'How we use it',
        body: [
          'To run the service — showing your requests to the right DJ, keeping your balance accurate, and letting DJs know who requested what.',
          'To prevent fraud and abuse.',
          'We do not sell your personal information.',
        ],
      },
      {
        heading: 'Who can see what',
        body: [
          'A DJ can see the requests sent to them, including your display name, the song, the tip amount and any message you attach.',
          'Your email address, phone number and wallet balance are not shown to other users.',
        ],
      },
      {
        heading: 'Payments',
        body: [
          'Payments are processed by Stripe. Your card details go directly to Stripe and never reach our servers. Stripe’s own privacy policy covers how they handle that data.',
        ],
      },
      {
        heading: 'Storage and security',
        body: [
          'Data is stored with Google Firebase. Access is restricted, and balances and transaction records can only be changed by our servers, never from a browser.',
        ],
      },
      {
        heading: 'Deleting your data',
        body: [
          'You can delete your account at any time from Settings. This removes your profile and request history, and frees your DJ username if you have one.',
          'Past requests you sent are kept for the DJ’s records but are anonymised — your name and message are removed.',
          'Records we must keep for legal or accounting reasons, such as payment records held by Stripe, may be retained.',
        ],
      },
    ],
  },

  refunds: {
    title: 'Refund Policy',
    intro: 'When money comes back, and when it does not.',
    sections: [
      {
        heading: 'Rejected requests',
        body: [
          'If a DJ rejects your request, the tip is returned to your BeatBiddr balance.',
          'Automatic refunds are still being rolled out. If a rejected request has not been credited back, contact us and we will put it right.',
        ],
      },
      {
        heading: 'Songs that are not played',
        body: [
          'Accepting a request is not a guarantee it will be played — a set can end or the night can change. If an accepted request is not played, contact us.',
          'A tip on a song that was played is not refundable.',
        ],
      },
      {
        heading: 'Wallet top-ups',
        body: [
          'Money added to your wallet can be used for any request on BeatBiddr.',
          'An unspent balance is not automatically refunded to your card, and deleting your account forfeits any remaining balance. Spend it first.',
        ],
      },
      {
        heading: 'Problems with a payment',
        body: [
          'If you were charged and your balance did not update, contact us with the date and amount and we will trace it against our payment records.',
          'Please contact us before disputing a charge with your bank — we can usually resolve it faster.',
        ],
      },
    ],
  },
};

const LegalPage: React.FC = () => {
  const { doc } = useParams<{ doc: string }>();
  const navigate = useNavigate();

  if (!doc || !DOCS[doc]) return <Navigate to="/" replace />;
  const content = DOCS[doc];

  return (
    <div className="app-shell bg-dark-600">
      <div className="app-scroll safe-top">
        <div className="px-6 pt-4 pb-12 max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-5 -ml-2">
            <button
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="p-2 text-neutral-400 hover:text-white"
            >
              <ChevronLeft size={21} />
            </button>
            <h1 className="text-[21px] font-extrabold tracking-[-0.035em]">{content.title}</h1>
          </div>

          <div className="flex gap-2.5 p-3.5 rounded-xl bg-white/[0.05] mb-6">
            <AlertTriangle size={16} className="text-neutral-400 shrink-0 mt-0.5" />
            <p className="text-[12.5px] muted leading-relaxed">
              Draft — not yet reviewed by a lawyer. Please have these checked before launch.
            </p>
          </div>

          <p className="text-[14px] muted leading-relaxed">{content.intro}</p>
          <p className="text-[12px] text-neutral-600 mt-2">Last updated {UPDATED}</p>

          {content.sections.map((section) => (
            <section key={section.heading} className="mt-8">
              <h2 className="text-[16px] font-bold tracking-[-0.02em]">{section.heading}</h2>
              {section.body.map((para, i) => (
                <p key={i} className="text-[13.5px] muted leading-relaxed mt-2.5">
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
