import { type ReactNode, useState } from "react";
import { Card, Eyebrow, Icon } from "../components/ui";
import { cx } from "../lib/util";

const TABS = ["Overview", "Signals", "Markets", "Motions", "Identity", "API"] as const;
type Tab = (typeof TABS)[number];

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <div
        className="shrink-0 w-9 h-9 rounded-xs grid place-items-center font-mono text-[13px] font-bold"
        style={{ background: "var(--color-emphasis-bg-deep)", color: "var(--color-emphasis-text)" }}
      >
        {n}
      </div>
      <div>
        <h3 className="font-heading text-[17px] font-semibold">{title}</h3>
        <p className="mt-1 text-[14px] text-muted">{children}</p>
      </div>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <pre
      className="rounded-xs overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed"
      style={{ background: "var(--color-gray-100)", color: "#f4f4f4" }}
    >
      {children}
    </pre>
  );
}

const B = ({ children }: { children: ReactNode }) => (
  <strong className="text-ink font-semibold">{children}</strong>
);

export function HowItWorks() {
  const [tab, setTab] = useState<Tab>("Overview");

  return (
    <div className="mx-[calc(50%-50vw)] px-8">
      <div className="grid gap-8 lg:grid-cols-[190px_minmax(0,1fr)] items-start">
        {/* Left menu */}
        <aside>
          <Eyebrow>how it works</Eyebrow>
          <nav className="mt-3 space-y-0.5">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cx(
                  "w-full text-left rounded-xs px-3 h-9 font-body text-[14px] transition-colors",
                  tab === t ? "bg-ink text-white" : "text-ink hover:bg-cream",
                )}
              >
                {t}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="space-y-6">
          {tab === "Overview" && (
        <div className="space-y-6">
          <p className="text-muted">
            moood GovFi is a portal for managing and overseeing a collective's decisions: raising motions,
            assessing them through signals, and tracking their financial and sentiment impact over
            time.
          </p>
          <div className="space-y-6">
            <Step n="1" title="Anonymous sentiment feeds an index">
              Any client sends anonymous sentiment for a collective. It is folded into an aggregate wellbeing
              index and discarded.
            </Step>
            <Step n="2" title="Two signals per decision">
              A play-money <B>forecast market</B> predicts whether the index improves under a motion,
              and a <B>sentiment</B> feed shows how the collective feels about it.
            </Step>
            <Step n="3" title="Advisory by default, binding by choice">
              By default nothing executes: a person reads both signals and decides. A signal can also
              be bound to a smart contract, configured to execute automatically on the sentiment
              result, the market outcome, or both.
            </Step>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <Icon name="visibility_off" className="text-muted" />
              <h4 className="mt-2 font-heading text-[15px] font-semibold">Aggregate-only</h4>
              <p className="mt-1 text-[13px] text-muted">No sentiment is stored with a user id.</p>
            </Card>
            <Card className="p-4">
              <Icon name="hub" className="text-muted" />
              <h4 className="mt-2 font-heading text-[15px] font-semibold">Open protocol</h4>
              <p className="mt-1 text-[13px] text-muted">Any client can feed sentiment.</p>
            </Card>
            <Card className="p-4">
              <Icon name="balance" className="text-muted" />
              <h4 className="mt-2 font-heading text-[15px] font-semibold">Advisory or binding</h4>
              <p className="mt-1 text-[13px] text-muted">Advises by default, or executes the outcome.</p>
            </Card>
          </div>
        </div>
      )}

      {tab === "Signals" && (
        <div className="space-y-6">
          <p className="text-muted">
            A signal is the pair of readings attached to a decision. It runs for a window, then closes.
          </p>
          <Step n="1" title="Forecast market">
            A play-money market over 1 to 30 year horizons predicts whether the wellbeing index will be
            higher under the motion. Longer horizons pay more because a baseline rate compounds over
            the term. A losing bet loses its stake.
          </Step>
          <Step n="2" title="Current sentiment">
            A live count of how many people feel positive or negative about the motion. It is
            anonymous; nothing is stored about who responded.
          </Step>
          <Step n="3" title="A window that opens and closes">
            Each signal has a start and end time. When it closes, the motion can be approved or denied
            on sentiment. This window maps to a moood pulse when dispatched to a linked org.
          </Step>
          <Step n="4" title="Resolution and disputes (planned)">
            After close, the outcome resolves and forecast stakes settle. Disputes hold funds in escrow
            while arbitrators decide edge cases, for example an org that ends before a long horizon.
          </Step>
          <Step n="5" title="Advisory, or binding (optional)">
            A signal is advisory by default. It can also be set to binding, so when it closes the
            outcome triggers a smart contract that executes the motion automatically.
          </Step>

          <div className="rounded-lg p-5" style={{ background: "var(--color-surface-cream)" }}>
            <Eyebrow>technicals</Eyebrow>
            <ul className="mt-2 space-y-1.5 text-[13px] text-ink-2">
              <li>The forecast market uses an LMSR automated market maker.</li>
              <li>Sentiment is collected through a blind relay with one-time HMAC tokens.</li>
              <li>Verification uses a proof-of-personhood provider such as World ID, BrightID, or Gitcoin Passport.</li>
            </ul>
          </div>
        </div>
      )}

      {tab === "Markets" && (
        <div className="space-y-6">
          <p className="text-muted">
            The forecast market runs on play money, but your stake is real. Back a side and you win
            from the other side, or lose your stake to it. That downside is what makes the price a
            genuine signal, and what rewards backing motions that actually lift sentiment.
          </p>

          <Step n="1" title="There is a loser, on purpose">
            Back positive and you are betting the motion lifts the wellbeing index. Back negative and
            you are betting it will not. The correct side takes the stakes of the wrong side. Being
            wrong costs you, which is what keeps the price honest.
          </Step>
          <Step n="2" title="The mover funds the market">
            Whoever raises a motion fronts a subsidy for it. A <B>company</B> pays for a forecast on
            its own decision, and the front is also its commitment to the motion. Shared questions
            like the <B>wellbeing index</B> are funded by the GovFi treasury. That subsidy is what pays
            informed forecasters, so taking part is worthwhile.
          </Step>
          <Step n="3" title="You profit from being right early">
            Positions can be sold back to the market at any time. As the forecast moves toward your
            view the price moves with it, and you can exit and take the gain. You never have to hold a
            long bet to the end.
          </Step>
          <Step n="4" title="Winners take the pot">
            An automated market maker prices each side between 0 and 100 percent. That price is what a
            token costs and the market's live probability that the motion helps. At resolution the
            correct side takes the losing side's stakes and the subsidy, split by the odds each bought
            at. The wrong side loses what it staked.
          </Step>
          <Step n="5" title="Longer horizons pay more for the wait">
            Stakes sit in escrow and earn a baseline yield for the term. A longer bet earns more, so
            its payout is grossed up by that rate compounded over the horizon. This pays you for the
            time your capital is at risk, it is not a safety net.
          </Step>

          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border-hairline)" }}>
            <table className="w-full text-[13px]">
              <thead>
                <tr
                  className="text-left font-mono text-[11px] text-muted"
                  style={{ background: "var(--color-surface-cream)" }}
                >
                  <th className="px-4 py-2 font-medium">horizon</th>
                  <th className="px-4 py-2 font-medium">payout</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["1 year", "1.05×"],
                  ["2 years", "1.10×"],
                  ["3 years", "1.16×"],
                  ["5 years", "1.28×"],
                  ["10 years", "1.63×"],
                  ["20 years", "2.65×"],
                  ["30 years", "4.32×"],
                ].map(([h, m]) => (
                  <tr key={h} style={{ borderTop: "1px solid var(--color-border-hairline)" }}>
                    <td className="px-4 py-2">{h}</td>
                    <td className="px-4 py-2 font-mono">{m}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-mono text-[11px] text-quiet">
            // payout = (1 + 0.05) ^ years · the baseline rate compounded over the term
          </p>

          <Step n="6" title="A cut funds the protocol">
            A portion of the upside goes to the GovFi treasury. That treasury funds the shared markets,
            like the wellbeing index, that no single company would pay for.
          </Step>
          <Step n="7" title="Disputes settle from escrow (planned)">
            If something ends early, for example an org that closes before a long horizon, arbitrators
            settle at the interest earned so far, or refund the stake. The money stays in escrow the
            whole time, so it is always covered.
          </Step>

          <div className="rounded-lg p-4" style={{ background: "var(--color-surface-cream)" }}>
            <Eyebrow>optional · growth reserve</Eyebrow>
            <p className="mt-2 text-[13px] text-ink-2">
              The yield escrowed stakes earn, and optionally a growth asset such as Bitcoin, builds the
              pot and funds the treasury. Stakes stay in a stable reserve, so the only risk you take is
              the bet itself, not the asset.
            </p>
          </div>

          <div>
            <Eyebrow>worked example</Eyebrow>
            <div className="mt-2">
              <Code>{`10-year horizon

mover fronts          →  §2,000 subsidy (added to the pot)
optimists back positive  →  §6,000 staked
skeptics back negative   →  §4,000 staked
escrow earns yield for the term

resolves positive:
  positive backers  →  stake back + the §4,000 + subsidy + yield
  negative backers  →  lose their §4,000

being wrong costs you. that is the signal.
a cut of the pot funds the GovFi treasury.`}</Code>
            </div>
          </div>
        </div>
      )}

      {tab === "Motions" && (
        <div className="space-y-6">
          <p className="text-muted">
            A motion puts a change or decision to a collective to assess: to determine a signal, whether
            for or against, or whether its impact will be positive or negative. It can include edits to
            the collective's documents, or it can simply be a question.
          </p>
          <Step n="1" title="Each collective has its governing documents">
            A collective owns a set of documents, such as a constitution, a contract, or its policies.
          </Step>
          <Step n="2" title="It can change one or several documents">
            A motion can edit a single document or several at once, for example a contract and a
            constitution together. Or it can be title only, a question with no document change.
          </Step>
          <Step n="3" title="Reviewed as before and after">
            What matters is the change itself, shown side by side as the current text and the proposed
            text, not a written summary.
          </Step>
          <Step n="4" title="Publishing opens a signal">
            When a motion is published it opens a signal, the readings the collective assesses it by.
          </Step>
          <Step n="5" title="Or synced from a DAO">
            A motion can also be synced from existing DAO governance such as Snapshot, Tally, Aragon,
            MakerDAO, or ENS. It arrives read-only, opens a signal, and links back to the source. The
            DAO motion's voting window becomes the signal's window.
          </Step>

          <div className="rounded-lg p-5" style={{ background: "var(--color-surface-cream)" }}>
            <Eyebrow>technicals</Eyebrow>
            <ul className="mt-2 space-y-1.5 text-[13px] text-ink-2">
              <li>Documents are versioned with git, so motions and their changes are tracked over time.</li>
            </ul>
          </div>
        </div>
      )}

      {tab === "Identity" && (
        <div className="space-y-6">
          <p className="text-muted">
            Responses are anonymous, but anonymity alone is gameable: without a check, one actor could
            submit thousands of responses. Verification solves a different problem than identity. It
            proves each response is one real, unique person, without revealing who.
          </p>
          <Step n="1" title="Verify once, anonymously">
            A proof-of-personhood provider such as World ID, BrightID, or Gitcoin Passport confirms you
            are a unique person and returns a token. No name, no email, no account.
          </Step>
          <Step n="2" title="The token asserts uniqueness only">
            It says one verified person, nothing about who you are, and it is not linked to your
            responses.
          </Step>
          <Step n="3" title="Used for one-per-person and trust">
            A signal can require the token so each person responds once, and can weight verified
            responses higher. Anonymity is kept; duplicate responses are not.
          </Step>
          <Code>{`POST /api/verify   // via a proof-of-personhood provider

200 OK
{ "verifiedToken": "vp_…" }   // proves uniqueness, not identity`}</Code>
        </div>
      )}

      {tab === "API" && (
        <div className="space-y-5">
          <p className="text-muted">
            Partners submit responses on behalf of their users through a gateway. Each response is a
            single anonymous submission, and a one-time blind token strips identity before it is
            recorded. Pre-production is self-service; production access is granted on request.
          </p>

          <div>
            <Eyebrow>register as a partner · pre-prod</Eyebrow>
            <p className="mb-2 text-[13px] text-muted">
              Self-service registration is for the pre-production environment only, for testing against
              pre-prod data. It issues a pre-prod gateway.
            </p>
            <Code>{`POST /api/partners   // pre-production only

{ "name": "Acme app", "contact": "dev@acme.io" }

200 OK
{ "gatewayId": "gw_…", "gatewaySecret": "gs_…", "env": "preprod" }`}</Code>
          </div>

          <div className="rounded-lg p-4" style={{ background: "var(--color-surface-cream)" }}>
            <Eyebrow>production access</Eyebrow>
            <p className="mt-2 text-[13px] text-ink-2">
              Production is not self-service. Submit a request to support@moood.tech to be approved as a
              partner.
            </p>
          </div>

          <div>
            <Eyebrow>sync a dao motion</Eyebrow>
            <Code>{`GET /api/sync/{platform}/motions/{motionId}
Authorization: Gateway gw_…:gs_…

200 OK
{
  "title": "…",
  "url": "https://…",
  "votingStart": 1785450000000,   // becomes the signal window
  "votingEnd": 1785970000000
}`}</Code>
            <p className="mt-2 text-[13px] text-muted">
              The imported motion opens a signal, and its voting window becomes the signal window.
            </p>
          </div>

          <div>
            <Eyebrow>get a blind token</Eyebrow>
            <Code>{`POST /api/signals/{signalId}/token
Authorization: Gateway gw_…:gs_…

{ "verifiedToken": "vp_…" }   // optional: one response per person

200 OK
{ "blindToken": "bt_…" }   // one-time, identity-stripped`}</Code>
          </div>

          <div>
            <Eyebrow>submit one response</Eyebrow>
            <Code>{`POST /api/sentiment

{
  "blindToken": "bt_…",
  "mood": {
    "signalId": "sig_…",
    "mood": 1,          // 1 positive, -1 negative, 0 no response
    "timestamp": 1785450000000
  }
}

200 OK
{ "accepted": true }`}</Code>
          </div>

          <p className="text-[13px] text-muted">
            Each call is one response. A relay verifies the token and records it without knowing who
            sent it. Someone who does not respond defaults to 0, which counts as positive when the
            signal aggregates.
          </p>

          <div>
            <Eyebrow>spam protection</Eyebrow>
            <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
              <li>Calls come only from verified partner gateways, each with its own credentials.</li>
              <li>The blind token is one-time and signed, so a response cannot be replayed.</li>
              <li>A verified token limits each person to one response per signal.</li>
              <li>Unverified responses carry less weight, so a flood barely moves the verified index.</li>
              <li>Rate limiting and bot detection sit in front of the API.</li>
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <Icon name="lock_open" className="text-muted" />
              <h4 className="mt-2 font-heading text-[15px] font-semibold">Open</h4>
              <p className="mt-1 text-[13px] text-muted">Any client can submit a response.</p>
            </Card>
            <Card className="p-4">
              <Icon name="visibility_off" className="text-muted" />
              <h4 className="mt-2 font-heading text-[15px] font-semibold">Anonymous</h4>
              <p className="mt-1 text-[13px] text-muted">The blind token strips identity.</p>
            </Card>
            <Card className="p-4">
              <Icon name="functions" className="text-muted" />
              <h4 className="mt-2 font-heading text-[15px] font-semibold">Aggregate</h4>
              <p className="mt-1 text-[13px] text-muted">Responses sum into the index.</p>
            </Card>
          </div>
          <p className="font-mono text-[10px] text-quiet">
            // wireframe · one response per attendee, through an identity-stripping relay
          </p>
        </div>
      )}

      <div className="rounded-lg p-5" style={{ background: "var(--color-surface-cream)" }}>
        <Eyebrow>poc scope</Eyebrow>
        <p className="mt-2 text-[13px] text-ink-2">
          Local, mock-data POC. No blockchain, wallets, tokens, or real money. See{" "}
          <code className="font-mono">ARCHITECTURE.md</code> and{" "}
          <code className="font-mono">PRIVACY.md</code>.
        </p>
      </div>
        </div>
      </div>
    </div>
  );
}
