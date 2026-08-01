import { Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Dashboard } from "./pages/Dashboard";
import { HowItWorks } from "./pages/HowItWorks";
import { Portfolio } from "./pages/Portfolio";
import { ProposalDetail } from "./pages/ProposalDetail";
import { ProposalEdit } from "./pages/ProposalEdit";
import { Proposals } from "./pages/Proposals";
import { Signals } from "./pages/Signals";

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/signals" element={<Signals />} />
        <Route path="/signals/:id" element={<ProposalDetail />} />
        <Route path="/motions" element={<Proposals />} />
        <Route path="/motions/:id" element={<ProposalEdit />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
      </Routes>
    </Shell>
  );
}
