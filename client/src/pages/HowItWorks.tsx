import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ProposalSummary } from "../lib/api";
import { Card, Eyebrow, Icon, MarqueePills, Pill, SourceBadge, SplitBar } from "../components/ui";
import { cx, pct } from "../lib/util";

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
        <div className="mt-1 space-y-3 text-[14px] leading-relaxed text-muted">{children}</div>
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

/**
 * A live, clickable reference card for moood's daily sentiment signal
 * ("How are you feeling?") — the naked baseline signal every wellbeing index is
 * built from. Rendered inside the Overview so the reader can see the real thing.
 */
function DailySignalCard() {
  const [sig, setSig] = useState<ProposalSummary | null>(null);

  useEffect(() => {
    api.proposals().then((ps) => setSig(ps.find((p) => p.naked) ?? null));
  }, []);

  if (!sig) return null;
  const total = sig.pulse.positive + sig.pulse.negative;

  return (
    <Link to={`/signals/${sig.id}`} className="block max-w-sm">
      <Card className="p-4 hover:shadow-lg transition-shadow" style={{ background: "var(--color-surface-soft)" }}>
        <MarqueePills>
          <span className="inline-flex" style={{ color: "var(--color-text-quiet)" }}>
            <Icon name="star" size={15} className="is-filled" />
          </span>
          <Pill tone={sig.status === "open" ? "green" : "grey"}>{sig.status}</Pill>
          <SourceBadge source={sig.source} />
          {sig.owner && <Pill tone="grey">owned by {sig.owner}</Pill>}
        </MarqueePills>

        <div className="mt-2 flex items-center gap-2">
          <h3 className="font-heading text-[16px] font-semibold text-ink">{sig.title}</h3>
          <Pill tone="red">Baseline Signal</Pill>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-4">
          {/* Predicted — greyed out: a baseline signal has no market. */}
          <div className="opacity-40">
            <div className="flex items-center justify-between font-mono text-[11px] text-muted">
              <span>predicted (1y)</span>
              <span>00%</span>
            </div>
            <div className="mt-1">
              <SplitBar left={0} leftColor="var(--color-text-quiet)" rightColor="var(--color-brand-hairline)" />
            </div>
            <div className="mt-1 font-mono text-[10px] text-quiet">P(wellbeing up)</div>
          </div>

          {/* Sentiment — live. */}
          <div>
            <div className="flex items-center justify-between font-mono text-[11px] text-muted">
              <span>sentiment now</span>
              <span className="text-ink font-semibold">{pct(sig.sentimentPositive)}</span>
            </div>
            <div className="mt-1">
              <SplitBar
                left={sig.sentimentPositive}
                leftColor="var(--color-emphasis-text-alt)"
                rightColor="var(--color-brand-hairline)"
              />
            </div>
            <div className="mt-1 font-mono text-[10px] text-quiet">{total.toLocaleString()} responses</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

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
                moood GovFi is a portal for raising motions within a collective and tracking their
                effect on its wellbeing over time.
              </p>
              <div className="space-y-6">
                <Step n="1" title="Futarchy">
                  Futarchy is a governance model, proposed by the economist Robin Hanson, that assigns
                  two decisions to two different mechanisms. A group uses <B>voting</B> to choose the
                  metric that defines success, and <B>prediction markets</B> to choose the actions taken
                  to improve it. For each proposal, a market predicts the value the metric would take if
                  that proposal were adopted, and the proposal with the best predicted metric is enacted.
                  Voting sets the goal; markets decide which action best reaches it. GovFi implements this
                  directly: the metric is a collective's wellbeing index, the proposals are motions, and
                  forecast markets estimate each motion's effect on that index.
                </Step>
                <Step n="2" title="Collectives">
                  A collective is the group a motion applies to: a company, a community, a cohort, or the
                  public. Each has one anonymous <B>wellbeing index</B> — a 0 to 100 aggregate of how its
                  individuals feel — built up over time from a daily pulse, How are you feeling?, sent to
                  everyone in the collective. No response is ever stored against a person.
                </Step>
                <Step n="3" title="Pulses">
                  <p>
                    A pulse is a check-in sent out from the moood app to a collective. The daily{" "}
                    <B>How are you feeling?</B> is a pulse, and its responses feed the wellbeing index; a
                    motion can also be dispatched as a pulse to gather sentiment on it.
                  </p>
                  <DailySignalCard />
                </Step>
                <Step n="4" title="Motions">
                  A motion is a proposal or question put to a collective — a policy change, a spending
                  decision, or an open question. Each person responds to it simply, with their sentiment:{" "}
                  <B>positive</B> or <B>negative</B>. A motion can edit the collective's governing
                  documents, or ask a question with no document change.
                </Step>
                <Step n="5" title="Signals">
                  A signal is the sentiment attached to a single motion or pulse: an anonymous aggregate
                  of those positive and negative responses, i.e. how the collective feels about it. The
                  signal is the container the rest of the model hangs on — a motion or pulse underneath,
                  and optionally a market on top.
                </Step>
                <Step n="6" title="Markets">
                  A market is an optional layer that attaches to a signal. It lets people stake on where
                  the collective's wellbeing index will sit over time, across horizons from 1 to 30 years.
                  For a motion, that forecast is the market's estimate of its long-term effect on
                  wellbeing. A market is not itself a signal; it rides on one.
                </Step>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="p-4">
                  <Icon name="visibility_off" className="text-muted" />
                  <h4 className="mt-2 font-heading text-[15px] font-semibold">Aggregate-only</h4>
                  <p className="mt-1 text-[13px] text-muted">No individual's sentiment is stored, only the aggregate.</p>
                </Card>
                <Card className="p-4">
                  <Icon name="hub" className="text-muted" />
                  <h4 className="mt-2 font-heading text-[15px] font-semibold">Open protocol</h4>
                  <p className="mt-1 text-[13px] text-muted">Anyone can contribute to a collective's daily sentiment through any client, not just the moood app.</p>
                </Card>
                <Card className="p-4">
                  <Icon name="balance" className="text-muted" />
                  <h4 className="mt-2 font-heading text-[15px] font-semibold">Advisory or binding</h4>
                  <p className="mt-1 text-[13px] text-muted">A motion advises by default, or executes its own outcome.</p>
                </Card>
              </div>
            </div>
          )}

          {tab === "Signals" && (
            <div className="space-y-6">
              <p className="text-muted">
                A motion is a question or proposal. Its signals are the feedback on it: sentiment about
                the motion itself, and a forecast market on the owning collective's long-term wellbeing
                index. Each runs for a window, then closes.
              </p>
              <Step n="1" title="Baseline: the wellbeing index">
                Anonymous daily sentiment aggregates into a 0 to 100 wellbeing index, tracked over time.
                It is the baseline every motion is measured against.
              </Step>
              <Step n="2" title="Motion sentiment">
                How the collective feels about the motion itself, now: an anonymous aggregate of positive
                and negative responses. Nothing is stored about who responded.
              </Step>
              <Step n="3" title="Forecast market">
                A market on the collective's long-term wellbeing index under the motion, over horizons
                from 1 to 30 years. See Markets.
              </Step>
              <Step n="4" title="Signal window">
                Each signal has a start and an end. When it closes, the readings settle. The window maps
                to a moood pulse when dispatched to a linked collective.
              </Step>
              <Step n="5" title="Resolution and disputes (planned)">
                After close, the forecast market resolves and stakes settle. Disputes hold funds in
                escrow while arbitrators handle edge cases, for example a collective that ends before a
                long horizon.
              </Step>
              <Step n="6" title="Advisory or binding">
                A signal is advisory by default. It can be set to binding: on close it triggers a smart
                contract that executes the motion, on the sentiment result, the market outcome, or both.
              </Step>

              <div className="rounded-lg p-5" style={{ background: "var(--color-surface-cream)" }}>
                <Eyebrow>technicals</Eyebrow>
                <ul className="mt-2 space-y-1.5 text-[13px] text-ink-2">
                  <li>Sentiment is collected through a blind relay with one-time HMAC tokens.</li>
                  <li>The forecast market uses an LMSR automated market maker.</li>
                  <li>Uniqueness comes from a proof-of-personhood provider (World ID, BrightID, Gitcoin Passport).</li>
                </ul>
              </div>
            </div>
          )}

          {tab === "Markets" && (
            <div className="space-y-6">
              <p className="text-muted">
                The forecast market is a prediction market on the collective's wellbeing index. Stakes
                are at risk: the correct side takes the losing side's stake.
              </p>

              <Step n="1" title="Two sides, one metric">
                Back positive that the motion raises the wellbeing index, or negative that it does not.
                At resolution the correct side takes the wrong side's stakes.
              </Step>
              <Step n="2" title="Mover-funded subsidy">
                Whoever raises the motion fronts a subsidy, added to the pot; it pays informed
                forecasters and is the mover's commitment. Shared markets, like the wellbeing index
                itself, are funded by the GovFi treasury.
              </Step>
              <Step n="3" title="Tradeable any time">
                Positions can be sold back to the market maker as the forecast moves, so you can exit
                before resolution rather than hold to the end.
              </Step>
              <Step n="4" title="LMSR pricing">
                An automated market maker prices each side between 0 and 100 percent, read as the live
                probability the motion raises the index. The price is a token's cost and its claim on
                the pot.
              </Step>
              <Step n="5" title="Horizon payouts">
                Stakes sit in escrow and earn a baseline rate for the term, so longer horizons pay more:
                the payout is grossed up by that rate compounded over the horizon. It compensates for the
                time capital is locked, not a floor.
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

              <Step n="6" title="Treasury cut">
                A portion of the upside funds the GovFi treasury, which funds the shared markets that no
                single collective would pay for.
              </Step>
              <Step n="7" title="Disputes settle from escrow (planned)">
                If a market ends early, arbitrators settle at the interest earned so far or refund the
                stake. Funds stay in escrow throughout.
              </Step>

              <div className="rounded-lg p-4" style={{ background: "var(--color-surface-cream)" }}>
                <Eyebrow>optional · growth reserve</Eyebrow>
                <p className="mt-2 text-[13px] text-ink-2">
                  Escrowed stakes earn a yield, and optionally a growth asset such as Bitcoin builds the
                  pot and funds the treasury. Stakes stay in a stable reserve, so the only risk is the
                  bet, not the asset.
                </p>
              </div>

              <div>
                <Eyebrow>worked example</Eyebrow>
                <div className="mt-2">
                  <Code>{`10-year horizon

mover subsidy            →  §2,000 (added to the pot)
positive backers staked  →  §6,000
negative backers staked  →  §4,000
escrow earns yield for the term

resolves positive:
  positive backers  →  stake back + §4,000 + subsidy + yield
  negative backers  →  lose their §4,000

a cut of the pot funds the GovFi treasury.`}</Code>
                </div>
              </div>
            </div>
          )}

          {tab === "Motions" && (
            <div className="space-y-6">
              <p className="text-muted">
                A motion is a change or a question put to a collective. It can edit the collective's
                documents, or be a question with no document change.
              </p>
              <Step n="1" title="Each collective has governing documents">
                A collective owns a document set: a constitution, contracts, policies. A document motion
                edits one of them.
              </Step>
              <Step n="2" title="Edit one or several documents">
                A motion can change a single document or several at once, or be title-only (a question).
              </Step>
              <Step n="3" title="Reviewed as a diff">
                A document motion is reviewed as a before/after diff, the current text against the
                proposed, like a pull request.
              </Step>
              <Step n="4" title="Publishing opens signaling">
                Publishing a motion opens its signals: motion sentiment and, if enabled, a forecast
                market.
              </Step>
              <Step n="5" title="Or synced from a DAO">
                A motion can be synced from DAO governance (Snapshot, Tally, Aragon, MakerDAO, ENS). It
                arrives read-only, opens signals, and links back to the source. The DAO proposal's voting
                window becomes the signal window.
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
                Responses are anonymous, but anonymity alone is gameable: one actor could submit
                thousands. Verification proves each response is one unique person, without revealing who.
              </p>
              <Step n="1" title="Verify once, anonymously">
                A proof-of-personhood provider (World ID, BrightID, Gitcoin Passport) confirms you are a
                unique person and returns a token. No name, email, or account.
              </Step>
              <Step n="2" title="The token proves uniqueness only">
                It asserts one verified person, nothing about who, and is not linked to your responses.
              </Step>
              <Step n="3" title="Used for one-per-person and weighting">
                A signal can require the token so each person responds once, and can weight verified
                responses higher.
              </Step>
              <Code>{`POST /api/verify   // via a proof-of-personhood provider

200 OK
{ "verifiedToken": "vp_…" }   // proves uniqueness, not identity`}</Code>
            </div>
          )}

          {tab === "API" && (
            <div className="space-y-5">
              <p className="text-muted">
                Partners submit responses on behalf of their users through a gateway. Each call is one
                anonymous response; a one-time blind token strips identity before it is recorded.
                Pre-production is self-service, production is granted on request.
              </p>

              <div>
                <Eyebrow>register as a partner · pre-prod</Eyebrow>
                <p className="mb-2 text-[13px] text-muted">
                  Self-service registration is for the pre-production environment only, against pre-prod
                  data. It issues a pre-prod gateway.
                </p>
                <Code>{`POST /api/partners   // pre-production only

{ "name": "Acme app", "contact": "dev@acme.io" }

200 OK
{ "gatewayId": "gw_…", "gatewaySecret": "gs_…", "env": "preprod" }`}</Code>
              </div>

              <div className="rounded-lg p-4" style={{ background: "var(--color-surface-cream)" }}>
                <Eyebrow>production access</Eyebrow>
                <p className="mt-2 text-[13px] text-ink-2">
                  Production is not self-service. Request access from support@moood.tech.
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
                  The imported motion opens signals, and its voting window becomes the signal window.
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
                A relay verifies the token and records the response without knowing who sent it. A
                non-response defaults to 0, which counts as positive when the signal aggregates.
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

              <p className="font-mono text-[10px] text-quiet">
                // wireframe · sentiment ingestion, one response per person, identity stripped by the relay
              </p>
            </div>
          )}

          <div className="rounded-lg p-5" style={{ background: "var(--color-surface-cream)" }}>
            <Eyebrow>poc scope</Eyebrow>
            <p className="mt-2 text-[13px] text-ink-2">
              Local, mock-data POC. No blockchain, wallets, or tokens. See{" "}
              <code className="font-mono">ARCHITECTURE.md</code> and{" "}
              <code className="font-mono">PRIVACY.md</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
