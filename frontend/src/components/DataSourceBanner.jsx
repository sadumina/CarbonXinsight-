import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Tooltip from "@mui/material/Tooltip";

export default function DataSourceBanner() {
  return (
    <div
      style={{
        background: "#F8FAFC",
        border: "1px solid #E2E8F0",
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        fontSize: 13,
        color: "#334155",
      }}
    >
      <Tooltip
        title="Price statistics are compiled from publicly available weekly market updates and validated during ingestion."
        arrow
      >
        <InfoOutlinedIcon
          style={{ fontSize: 16, marginRight: 8, cursor: "pointer" }}
        />
      </Tooltip>

      <span>
        <strong>Data Source:</strong> Weekly price updates from{" "}
        <a
          href="https://coconutcommunity.org/page-statistics/weekly-price-update"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#2563EB", textDecoration: "none", fontWeight: 500 }}
        >
          Coconut Community – Weekly Price Update
        </a>
      </span>

      <OpenInNewIcon style={{ fontSize: 14, marginLeft: 6 }} />
    </div>
  );
}
