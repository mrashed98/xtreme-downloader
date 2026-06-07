import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { Bolt } from "../ds";
import { PlaylistSwitcher } from "./TopNav";

export function MobileTop() {
  const navigate = useNavigate();
  return (
    <header className="xmtop">
      <span style={{ width: 26, height: 26 }}>
        <Bolt size={26} />
      </span>
      <span className="xmtop__word" onClick={() => navigate("/")}>
        X<b>TREME</b>
      </span>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <PlaylistSwitcher />
        <button
          className="xtop__icbtn"
          style={{ width: 38, height: 38 }}
          onClick={() => navigate("/settings")}
          aria-label="Settings"
        >
          <Settings size={19} />
        </button>
      </div>
    </header>
  );
}
