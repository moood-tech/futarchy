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

/** Like Step but lettered (a, b, c…) — for a set of features rather than a sequence. */
function Feature({ letter, title, children }: { letter: string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <div
        className="shrink-0 w-9 h-9 rounded-xs grid place-items-center font-mono text-[13px] font-bold"
        style={{ background: "var(--color-emphasis-bg-deep)", color: "var(--color-emphasis-text)" }}
      >
        {letter}
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
 * ("How are you feeling?"), the naked baseline signal every wellbeing index is
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
    <Link to={`/signals/${sig.id}`} className="block max-w-sm mx-auto">
      <Card className="p-4 hover:shadow-lg transition-shadow" style={{ background: "var(--color-surface-soft)" }}>
        <MarqueePills>
          <span className="inline-flex" style={{ color: "var(--color-text-quiet)" }}>
            <Icon name="star" size={15} className="is-filled" />
          </span>
          <Pill tone={sig.status === "open" ? "green" : "grey"}>{sig.status}</Pill>
          <SourceBadge source={sig.source} />
          {sig.owner && <Pill tone="grey">{sig.owner}</Pill>}
        </MarqueePills>

        <div className="mt-2 flex items-center gap-2">
          <h3 className="font-heading text-[16px] font-semibold text-ink">{sig.title}</h3>
          <Pill tone="red">Baseline Signal</Pill>
        </div>

        {/* Baseline signal has no market, so sentiment spans the full width. */}
        <div className="mt-3">
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
              <div>
                <Eyebrow>what is moood govfi</Eyebrow>
                <div className="mt-2 space-y-3 text-muted">
                  <p>
                    moood GovFi is a portal for governing with <B>futarchy</B>, a model proposed by the
                    economist Robin Hanson. Futarchy separates a decision into two questions handled by two
                    mechanisms. A collective first agrees on the metric that defines success. Prediction
                    markets then forecast which proposal would move that metric the most, in place of a
                    direct vote. In GovFi the metric is a collective's <B>wellbeing index</B>, an anonymous
                    score from 0 to 100 of how its people feel, and each proposal, termed a motion, carries
                    a forecast market that estimates its long-term effect on that index.
                  </p>
                  <p>
                    moood is not a strict implementation of futarchy. In pure futarchy the market
                    determines the outcome. GovFi instead combines the forecast market with{" "}
                    <B>direct democracy</B>: each motion also records popular sentiment, the collective's
                    current opinion of it, and the collective interprets both signals before implementing.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <Eyebrow>components</Eyebrow>
                <Step n="1" title="Collectives">
                  A collective is the group a motion applies to, such as a company, a community, a cohort,
                  or the public. Each collective has one anonymous <B>wellbeing index</B>, an aggregate
                  from 0 to 100 of how its individuals feel, built up over time from moood's{" "}
                  <B>Baseline Signal</B>, which is available to everyone to participate in.
                </Step>
                <Step n="2" title="Pulses">
                  A pulse is a poll that moood sends to the members of a collective, prompting each person
                  to respond with their sentiment. Each pulse gathers one round of responses, and these are
                  not limited to the moood app: any client can respond to pulses and submit them to a
                  signal through moood's open <B>API</B>. See the API section for the endpoints.
                </Step>
                <Step n="3" title="Signals">
                  <p>
                    A signal is a collective's aggregated sentiment: an anonymous tally of positive and
                    negative responses, built from one or more pulses collected over time. A signal can
                    carry a motion, gathering sentiment on it.
                  </p>
                  <DailySignalCard />
                </Step>
                <Step n="4" title="Motions">
                  <p>
                    A motion is a proposal or question put to a collective, for example a policy change, a
                    spending decision, or an open question. Each person responds with their sentiment,{" "}
                    <B>positive</B> or <B>negative</B>.
                  </p>
                  <p>
                    A motion can add a <B>git repository</B> of markdown documents and select the files to
                    change within it. Each change is shown as a diff for review, as in a pull request, and
                    git preserves every version, so the repository retains a complete and auditable
                    history.
                  </p>
                </Step>
                <Step n="5" title="Markets">
                  A market is a prediction market on a collective's wellbeing index, the metric futarchy
                  optimises. For a signal carrying a motion or pulse, it forecasts the index conditional on
                  that signal across horizons from 1 to 30 years, and the price is the market's estimate of
                  the signal's long-term effect on the index.
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
                A signal is a collective's aggregated sentiment on one subject: an anonymous tally of
                positive and negative responses. It records only the aggregate, never a per-response
                identity.
              </p>
              <Feature letter="a" title="Trust thresholds">
                The reading is reported three ways: unverified, counting every response equally; verified,
                counting proof-of-personhood responses only; and weighted, a trust-weighted blend of the
                two.
              </Feature>
              <Feature letter="b" title="Windowed lifecycle">
                A signal opens at a start time, accepts responses while open, and closes at an end time,
                at which point the reading settles.
              </Feature>
              <Feature letter="c" title="Advisory or binding">
                A signal is advisory by default. Set to binding, closing it triggers a smart contract that
                executes on the result.
              </Feature>

              <div>
                <Eyebrow>api usage</Eyebrow>
                <div className="mt-2 space-y-5 text-[13px] text-muted">
                  <div className="space-y-2">
                    <p>Import a signal from a DAO. Its voting window becomes the signal window.</p>
                    <Code>{`GET /api/sync/{platform}/motions/{motionId}
Authorization: Gateway gw_…:gs_…

200 OK
{
  "title": "…",
  "url": "https://…",
  "votingStart": 1785450000000,   // becomes the signal window
  "votingEnd": 1785970000000
}`}</Code>
                  </div>
                  <div className="space-y-2">
                    <p>Get a one-time, identity-stripped blind token to respond to a signal.</p>
                    <Code>{`POST /api/signals/{signalId}/token
Authorization: Gateway gw_…:gs_…

{ "verifiedToken": "vp_…" }   // optional: one response per person

200 OK
{ "blindToken": "bt_…" }   // one-time, identity-stripped`}</Code>
                  </div>
                  <div className="space-y-2">
                    <p>
                      Submit a response with the blind token. A relay records it without knowing who sent
                      it; a non-response defaults to 0, which counts as positive.
                    </p>
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
                </div>
              </div>

              <Card className="p-5">
                <Eyebrow>spam protection</Eyebrow>
                <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
                  <li>Calls come only from verified partner gateways, each with its own credentials.</li>
                  <li>The blind token is one-time and signed, so a response cannot be replayed.</li>
                  <li>Unverified responses carry less weight, so a flood barely moves the verified index.</li>
                  <li>Rate limiting and bot detection sit in front of the API.</li>
                </ul>
              </Card>
            </div>
          )}

          {tab === "Markets" && (
            <div className="space-y-6">
              <div
                className="flex items-start gap-3 rounded-lg p-4"
                style={{ background: "var(--color-surface-cream)" }}
              >
                <Icon name="info" size={16} className="text-muted shrink-0 mt-0.5" />
                <p className="text-[13px] text-ink-2">
                  Conceptual, and a work in progress. The market design described here is not yet a
                  sound financial structure and is not offered as a product. It will not be until the
                  mechanism, the incentives, and the regulatory position have been worked out.
                </p>
              </div>

              <p className="text-muted">
                The forecast market is a prediction market on the collective's wellbeing index. Stakes
                are at risk: the correct side takes the losing side's stake.
              </p>

              <div>
                <Eyebrow>internal and external markets</Eyebrow>
                <div className="mt-2 space-y-3 text-[14px] leading-relaxed text-muted">
                  <p>
                    Optimising a single collective's index has a failure mode. The decision rule sees only
                    that one metric, so a motion that raises the proposing collective's index at the expense
                    of people outside it still clears the market. The price is efficient; the objective is
                    misspecified. It internalises the proposer's welfare and prices the externality at zero.
                  </p>
                  <p>
                    moood runs the forecast on two metrics instead. Each motion carries an{" "}
                    <B>internal market</B> on the proposing collective's index and an <B>external market</B>{" "}
                    on the wellbeing index of the population it affects. Weighted by population, the two
                    approximate the change in total welfare, so a motion that is a gain for the collective
                    but a net loss overall is legible rather than rewarded.
                  </p>
                </div>
              </div>

              <Feature letter="a" title="Two sides, one metric">
                Back positive that the motion raises the wellbeing index, or negative that it does not.
                At resolution the correct side takes the wrong side's stakes.
              </Feature>
              <Feature letter="b" title="Mover-funded subsidy">
                Whoever raises the motion fronts a subsidy, added to the pot; it pays informed
                forecasters and is the mover's commitment. Shared markets, like the wellbeing index
                itself, are funded by the GovFi treasury.
              </Feature>
              <Feature letter="c" title="Tradeable any time">
                Positions can be sold back to the market maker as the forecast moves, so you can exit
                before resolution rather than hold to the end.
              </Feature>
              <Feature letter="d" title="LMSR pricing">
                An automated market maker prices each side between 0 and 100 percent, read as the live
                probability the motion raises the index. The price is a token's cost and its claim on
                the pot.
              </Feature>
              <Feature letter="e" title="Horizon payouts">
                Stakes sit in escrow and earn a baseline rate for the term, so longer horizons pay more:
                the payout is grossed up by that rate compounded over the horizon. It compensates for the
                time capital is locked, not a floor.
              </Feature>

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

              <Feature letter="f" title="Treasury cut">
                A portion of the upside funds the GovFi treasury, which funds the shared markets that no
                single collective would pay for.
              </Feature>
              <Feature letter="g" title="Disputes settle from escrow (planned)">
                If a market ends early, arbitrators settle at the interest earned so far or refund the
                stake. Funds stay in escrow throughout.
              </Feature>

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
                A motion is a proposal or question put to a collective.
              </p>
              <Feature letter="a" title="Documents">
                Motions support supplemental documents, which can be included as changes in the proposal.
                Documents can also be motioned on directly: a collective connects a <B>git repository</B>{" "}
                of <B>markdown files</B>, and a motion selects one or more of them to change. With no
                documents, a motion is a title-only question.
              </Feature>
              <Feature letter="b" title="Change management">
                Every motion is handled as a set of <B>version-controlled</B> changes rather than a
                free-form edit. The proposed edits are
                presented as a <B>diff</B> of the current text against the motion's version, in the same
                way that a <B>pull request</B> shows a change for review before it is merged. When a motion
                is settled its edits are <B>committed</B>, so the repository retains the{" "}
                <B>full history</B> of how each document has evolved and any earlier state remains
                recoverable.
              </Feature>
            </div>
          )}

          {tab === "Identity" && (
            <div className="space-y-6">
              <div
                className="flex items-start gap-3 rounded-lg p-4"
                style={{ background: "var(--color-surface-cream)" }}
              >
                <Icon name="info" size={16} className="text-muted shrink-0 mt-0.5" />
                <p className="text-[13px] text-ink-2">
                  Work in progress. The verification and weighting model described here is a design
                  direction, not a final specification, and the mechanics may change.
                </p>
              </div>

              <p className="text-muted">
                Two properties have to hold at once: every response is <B>anonymous</B>, so identity is
                never linked to what was submitted, and each real person is <B>unique</B>, so they cannot
                be counted many times. Anonymity is the standing invariant. Uniqueness is what verification
                establishes, without breaking anonymity.
              </p>

              <div>
                <Eyebrow>verification</Eyebrow>
                <ul className="mt-2 space-y-2 text-[14px] leading-relaxed text-muted list-disc pl-5 marker:text-quiet">
                  <li>
                    Responses carry no identifier, so the protocol is anonymous by construction. Anonymity
                    on its own is Sybil-vulnerable: one actor can submit an unbounded number of responses.
                  </li>
                  <li>
                    To participate, a user registers an <B>account</B> and verifies it through an{" "}
                    <B>identity provider</B> such as World ID, BrightID, or Gitcoin Passport.
                  </li>
                  <li>
                    The provider attests that the account belongs to a distinct, real individual and returns
                    a <B>uniqueness credential</B>. The credential certifies uniqueness only: it carries no
                    name, email, or wallet, and is not bound to any response.
                  </li>
                  <li>
                    A single provider only guarantees uniqueness within itself. moood integrates every
                    supported provider and <B>reconciles their attestations against each other</B>, so one
                    person cannot verify through several providers to open multiple accounts and respond more
                    than once.
                  </li>
                  <li>
                    Verification binds to the <B>account</B>, not to the response. A verified account still
                    submits anonymously: the response proves it came from a unique verified person, never
                    which account sent it, so identity and sentiment are never linked.
                  </li>
                </ul>
              </div>

              <div>
                <Eyebrow>blind relay</Eyebrow>
                <ul className="mt-2 space-y-2 text-[14px] leading-relaxed text-muted list-disc pl-5 marker:text-quiet">
                  <li>
                    Responses are never written directly. They pass through a <B>blind relay</B> that
                    separates who is allowed to respond from what is submitted.
                  </li>
                  <li>
                    Every participant, verified or not, has a <B>user or device id</B>. That id is used to
                    request a <B>one-time token</B> for a signal; the id is never attached to the response.
                  </li>
                  <li>
                    The token is what the response is submitted with. It works like the identity
                    attestation at the transport layer: it proves the sender is <B>permitted to respond</B>{" "}
                    without the relay learning who they are.
                  </li>
                  <li>
                    The token is single-use and signed. The relay accepts one response per token and rejects
                    replays, so a given id can respond <B>only once</B> to a signal. The relay then records
                    the response and discards the identifier, so nothing links the id to the sentiment.
                  </li>
                </ul>
              </div>

              <div>
                <Eyebrow>weighting</Eyebrow>
                <div className="mt-2 space-y-3 text-[14px] leading-relaxed text-muted">
                  <p>
                    Every response is anonymous. What differs is whether it carries a uniqueness credential,
                    and that sets its <B>trust weight</B> in the aggregate. Weight is a function of
                    verification state, never of content.
                  </p>
                  <ul className="space-y-2 list-disc pl-5 marker:text-quiet">
                    <li>
                      <B>Verified</B> response, from an account holding a current uniqueness credential:
                      weight <B>1.0</B>.
                    </li>
                    <li>
                      <B>Unverified</B> response, anonymous with no credential: weight <B>0.25</B>. It still
                      counts, but four unverified responses move the index as much as one verified response,
                      which bounds how far a Sybil flood can push it.
                    </li>
                  </ul>
                  <p>The same responses are published at three thresholds, so the reader picks the trust model:</p>
                  <ul className="space-y-2 list-disc pl-5 marker:text-quiet">
                    <li>
                      <B>unverified</B>: every response counted equally, verification ignored. Broadest and
                      most Sybil-exposed.
                    </li>
                    <li>
                      <B>verified</B>: only responses from verified accounts counted. Narrowest and highest
                      trust.
                    </li>
                    <li>
                      <B>weighted</B>, the default: all responses counted, each scaled by its trust weight.
                      With roughly a third of respondents verified this lands near 0.63 verified plus 0.37
                      unverified.
                    </li>
                  </ul>
                  <p>
                    The gap between the verified and unverified figures is diagnostic: a large divergence
                    indicates coordinated or Sybil activity that a single blended number would conceal.
                  </p>
                </div>
              </div>

              <div>
                <Eyebrow>api usage</Eyebrow>
                <div className="mt-2">
                  <Code>{`POST /api/verify

200 OK
{ "verifiedToken": "vp_…" }   // proves uniqueness, not identity`}</Code>
                </div>
              </div>
            </div>
          )}

          {tab === "API" && (
            <div className="space-y-5">
              <p className="text-muted">
                Partners submit responses on behalf of their users through a gateway. Every gateway call
                is authenticated with the partner's gateway id and secret (
                <code className="font-mono">Authorization: Gateway gw_…:gs_…</code>). Register for a
                gateway to obtain them.
              </p>

              <div
                className="flex items-start gap-3 rounded-lg p-4"
                style={{ background: "var(--color-surface-cream)" }}
              >
                <Icon name="info" size={16} className="text-muted shrink-0 mt-0.5" />
                <p className="text-[13px] text-ink-2">
                  Production is not self-service. Request access from support@moood.tech.
                </p>
              </div>

              <div className="space-y-2">
                <Eyebrow>api usage</Eyebrow>
                <p className="text-[13px] text-muted">
                  Register a partner to obtain a gateway id and secret.
                </p>
                <Code>{`POST /api/partners

{ "name": "Acme app", "contact": "dev@acme.io" }

200 OK
{ "gatewayId": "gw_…", "gatewaySecret": "gs_…", "env": "preprod" }`}</Code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
