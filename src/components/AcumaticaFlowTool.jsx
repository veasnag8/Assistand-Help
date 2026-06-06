import { useMemo, useState } from "react";

const accessRightText = `User Access right by Team update on 06/05/22
No.	Module/Screen	Description	Action	Team	User
I. Stock Request Internal					
1	Stock Request	- Create Stock Request	Save	W.H Officer Site	
		- Check/Review the request	Confirm/Approve/Correct	W.H (Mega)	
		- Verify and agree	Generate	W.H Manager Site	
2	Request	- Check and copy Ext. Ref	Save, Remove hold	W.H (Mega)	
		- Approval of request	Approve	W.H HOD (Mega)	Suos Savodey, Mr.
		- Create Order	Create Order	W.H Officer Site	
3	Purchase Receipt	- Create/Edit purchase receipt	Save	W.H Officer Site	
		- Check/Review purchase receipt	Unhold	W.H Manager Site	
		- Verify and agree	Release	W.H (Mega)	
4	AP Bill	- Create AP Bill	Save	F.D (VCL)	
		- Check/Review	Unhold	F.D (VCL)	
		- Verify and agree	Release	F.D (VCL)	
5	Payment AP	- Create payment	Save	F.D (VCL)	
		- Check/Review	Unhold	F.D (VCL)	
		- Verify and agree	Release	F.D (VCL)	
6	Stock Issue	- Create Stock Issue	Save	W.H Officer Site	
		- Check/Review the stock issue	Unhold	W.H Manager Site	
		- Verify and agree	Release	W.H (Mega)	
7	Sale Order	- Create Sale Order	Save	W.H Officer Site	
		- Check/Review Sale order	Unhold -> Create Shipment	W.H Manager Site	
8	Shipment	- Input actual item & Qty to be sent out (if have many deliveries)	Save	W.H Officer Site	
		- Check/Review the stock to be sent out	Unhold -> Confirm Shipment	W.H Manager Site	
		- If found any error, inform site to edit	Correct Shipment	W.H (Mega)	
		- Verify and agree	Update IN (Release)	W.H (Mega)	
9	AR Invoice	- Create AR Invoice	Save	W.H Officer Site	
		- Check/Review	Unhold	W.H Manager Site	
		- Verify and agree	Release	F.D (VCL)	
10	Payment AR	- Create payment	Save	F.D (VCL)	
		- Check/Review	Unhold	F.D (VCL)	
		- Verify and agree	Release	F.D (VCL)	
II. Stock Request External					
1	Stock Request	- Create Stock Request	Save	W.H Officer Site	
		- Check/Review the request	Confirm/Approve/Correct	W.H (Mega)	
		- Verify and agree	Generate	W.H Manager Site	
2	Request	- Check and copy Tel number	Save/Unhold	W.H (Mega)	
		- Input Purchaser	Hold/Unhold	P.D (Mega)	Yea Yeang
		- Approval of request	Approve	P.D HOD (Mega) + WH MAM	Chheang Sereyrayuth or Lin Rui Tao
3	Requisition	- Create/Separate request/Add Bidding vendor	Save	P.D (Mega)	
		- Check/Review the requisition	Unhold	P.D (Mega)	
		- Bidding Response (Input Quot. price)	Save	P.D (Mega)	
		- Complete Bidding (Final vendor selection)	Save/Complete Bidding	P.D (Mega)	Chheang Sereyrayuth or Lin Rui Tao
		- Create Order	Create Order	P.D (Mega)	
4	Purchase Order	- Create/Edit Purchase Order	Save/Unhold	P.D (Mega)	
		- Approve Purchase Order	Approve	P.D HOD (Mega)	
5	Purchase Receipt	- Create/Edit purchase receipt	Save	W.H Officer Site	
		- Check/Review purchase receipt	Unhold	W.H Manager Site	
		- Verify and agree	Release	W.H (Mega)	
6	AP Bill	- Create AP Bill	Save	P.D (Mega)	
		- Check/Review	Unhold	P.D (Mega)	
		- Verify and agree	Release	P.D (Mega)	
7	Payment AP	- Create payment	Save	F.D (VCL)	
		- Check/Review	Unhold	F.D (VCL)	
		- Verify and agree	Release	F.D (VCL)	
III. Request Fixed Asset exclude IT equipment/Software (Process by Purchasing Division)					
1	Request	- Create Request (Input information/Phone Number)	Save/Unhold	Admin (Mega)	
		- Check/Review	Hold/Unhold	Admin (Mega)	
		- Approval of request	Approve	Head of Admin	Yang Sopheap
2	Requisition	- Create/Separate request/Add Bidding vendor	Save	P.D (Mega)	
		- Check/Review the requisition	Unhold	P.D (Mega)	
		- Bidding Response (Input Quot. price)	Save	P.D (Mega)	
		- Complete Bidding (Final vendor selection)	Save/Complete Bidding	P.D (Mega)	Chheang Sereyrayuth
		- Create Order	Create Order	P.D (Mega)	
3	Purchase Order	- Create/Edit Purchase Order	Save/Unhold	P.D (Mega)	
		- Approve Purchase Order	Approve	P.D HOD (Mega)	
4	Purchase Receipt	- Create/Edit purchase receipt	Save	Admin (Mega)	
		- Check/Review purchase receipt	Unhold	Admin (Mega)	
		- Verify and agree	Release	Head of Admin	Yang Sopheap
5	AP Bill	- Create AP Bill	Save	P.D (Mega)	
		- Check/Review	Unhold	P.D (Mega)	
		- Verify and agree	Release	P.D (Mega)	
6	Payment AP	- Create payment	Save	F.D (VCL)	
		- Check/Review	Unhold	F.D (VCL)	
		- Verify and agree	Release	F.D (VCL)	
IV. Request IT Equipment/Software  (Process by IT Team)					
1	Request	- Create Request (Input information/Phone Number)	Save/Unhold	Admin (Mega)	
		- Check/Review	Hold/Unhold	Admin (Mega)	
		- Approval of request	Approve	Head of Admin	Yang Sopheap
2	Requisition	- Create/Separate request/Add Bidding vendor	Save	IT (Mega)	
		- Check/Review the requisition	Unhold	IT (Mega)	
		- Bidding Response (Input Quot. price)	Save	IT (Mega)	
		- Complete Bidding (Final vendor selection)	Save/Complete Bidding	IT (Mega)	
		- Create Order	Create Order	IT (Mega)	
3	Purchase Order	- Create/Edit Purchase Order	Save/Unhold	IT (Mega)	
		- Approve Purchase Order	Approve	System Support	
4	Purchase Receipt	- Create/Edit purchase receipt	Save	Admin (Mega)	
		- Check/Review purchase receipt	Unhold	Admin (Mega)	
		- Verify and agree	Release	Head of Admin	Yang Sopheap
5	AP Bill	- Create AP Bill	Save	IT (Mega)	
		- Check/Review	Unhold	IT (Mega)	
		- Verify and agree	Release	IT (Mega)	
6	Payment AP	- Create payment	Save	F.D (VCL)	
		- Check/Review	Unhold	F.D (VCL)	
		- Verify and agree	Release	F.D (VCL)	
V. Petty Cash					
1	Petty Cash	- Input Petty Cash (Cash Purchase)	Save	Admin (Site)	
		- Select account suspend	Save	Admin (Site)	
2	Allocated Expense	- Change COA (Expense)	Save	F.D (VCL)	
		- Remove Hold by Senior	Remove Hold	F.D Senior	
		- Release by Finance Manager or Supervisor	Release	F.D (VCL)	Finance Manager: for Adjustment; Supervisor: for Non-Adjustment
3	Fund Transfer	- Input Fund Transfer	Save/Unhold	F.D (VCL)	
		- Select Source Account: Bank Current / Saving	Save	F.D (VCL)	
		- Select Destination Account: Petty at Bank	Save	F.D (VCL)	
		- Remove Hold by Senior	Remove Hold	F.D Senior	
		- Release by Finance Manager or Supervisor	Release	F.D (VCL)	Finance Manager: for Adjustment; Supervisor: for Non-Adjustment
4	Cash Purchase	- Input Cash Purchase	Save/Unhold	F.D (VCL)	
		- Payment Method: Cash	Save	F.D (VCL)	
		- Select Header Cash Account: Petty at Bank	Save	F.D (VCL)	
		- Select Detail Account: Petty Cash	Save	F.D (VCL)	
		- Remove Hold by Senior	Remove Hold	F.D Senior	
		- Release by Finance Manager or Supervisor	Release	F.D (VCL)	Finance Manager: for Adjustment; Supervisor: for Non-Adjustment`;

function parseAccessRightText(text) {
  const sections = [];
  let currentSection = null;
  let currentProcess = null;

  text.split(/\r?\n/).slice(2).forEach((line) => {
    const cells = line.split("\t");
    const [no = "", module = "", description = "", action = "", team = "", user = ""] = cells;

    if (/^[IVX]+\./.test(no)) {
      currentSection = { id: no.replace(".", "").toLowerCase(), title: no.trim(), processes: [] };
      sections.push(currentSection);
      currentProcess = null;
      return;
    }

    if (!currentSection || !description.trim()) {
      return;
    }

    if (no.trim() && module.trim()) {
      currentProcess = {
        no: no.trim(),
        module: module.trim(),
        steps: [],
      };
      currentSection.processes.push(currentProcess);
    }

    if (!currentProcess) {
      return;
    }

    currentProcess.steps.push({
      description: description.replace(/^-\s*/, "").trim(),
      action: action.trim(),
      team: team.trim(),
      user: user.trim(),
    });
  });

  return sections;
}

function getSectionLabel(title) {
  if (title.includes("Request Fixed Asset")) {
    return "Request Fixed Asset";
  }

  return title.replace(/^[IVX]+\.\s*/, "");
}

function getSectionUpdatedDate(title) {
  if (title.includes("Petty Cash")) {
    return "22/05/2026";
  }

  return "06/05/22";
}

function getTeamTone(team) {
  if (team.startsWith("Admin") || team === "Head of Admin") {
    return "admin";
  }

  if (team.startsWith("P.D")) {
    return "pd";
  }

  if (team.startsWith("F.D")) {
    return "fd";
  }

  if (team.startsWith("W.H")) {
    return "wh";
  }

  return "other";
}

function getProcessStage(sectionTitle, processNo) {
  if (!sectionTitle.includes("Petty Cash")) {
    return "";
  }

  return processNo === "1" || processNo === "2" ? "ដំណាក់កាលទី1" : "ដំណាក់កាលទី2";
}

export default function AcumaticaFlowTool() {
  const sections = useMemo(() => parseAccessRightText(accessRightText), []);
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id || "");
  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0];
  const filteredProcesses = activeSection.processes;

  return (
    <section className="acumatica-flow-tool" aria-labelledby="acumatica-flow-title">
      <h1 className="sr-only" id="acumatica-flow-title">Acumatica Process Flow</h1>
      <div className="acumatica-flow-update">
        <span>Last update</span>
        <strong>{getSectionUpdatedDate(activeSection.title)}</strong>
      </div>

      <div className="acumatica-flow-tabs" role="tablist" aria-label="Process groups">
        {sections.map((section) => (
          <button
            key={section.id}
            className={section.id === activeSection.id ? "is-active" : ""}
            type="button"
            onClick={() => setActiveSectionId(section.id)}
          >
            {getSectionLabel(section.title)}
          </button>
        ))}
      </div>

      <div className="acumatica-flow-table-wrap">
        <table className="acumatica-flow-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Stage</th>
              <th>Module/Screen</th>
              <th>Description</th>
              <th>Action</th>
              <th>Team</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            {filteredProcesses.flatMap((process) =>
              process.steps.map((step, index) => (
                <tr
                  className={`team-tone-${getTeamTone(step.team)}`}
                  key={`${process.no}-${process.module}-${step.description}-${index}`}
                >
                  <td>{index === 0 ? process.no : ""}</td>
                  <td>{index === 0 ? getProcessStage(activeSection.title, process.no) : ""}</td>
                  <td>{index === 0 ? process.module : ""}</td>
                  <td>{step.description}</td>
                  <td>{step.action}</td>
                  <td>{step.team}</td>
                  <td>{step.user}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
