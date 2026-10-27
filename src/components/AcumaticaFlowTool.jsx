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
		- Release by Finance Manager or Supervisor	Release	F.D (VCL)	
3	Fund Transfer	- Input Fund Transfer	Save	F.D (VCL)	
		- Select Source Account: Bank Current / Saving	Save	F.D (VCL)	
		- Select Destination Account: Petty at Bank	Save	F.D (VCL)	
		- Remove Hold by Senior	Remove Hold	F.D Senior	
		- Release by Finance Manager or Supervisor	Release	F.D (VCL)	
4	Cash Purchase	- Input Cash Purchase	Save	F.D (VCL)	
		- Payment Method: Cash	Save	F.D (VCL)	
		- Select Header Cash Account: Petty at Bank	Save	F.D (VCL)	
		- Select Detail Account: Petty Cash	Save	F.D (VCL)	
		- Remove Hold by Senior	Remove Hold	F.D Senior	
		- Release by Finance Manager or Supervisor	Release	F.D (VCL)	
VI. កែតម្រូវ AP ខុស					
1	AP Bill បាន Released រួចហើយ - ចំនួនទឹកប្រាក់ខុស	ត្រូវបង្កើត Debit Adj ដើម្បីកាត់បន្ថយ ឬបញ្ច្រាសចំនួនដែលខុស	បង្កើត Debit Adj	F.D (VCL)	
		- ឧទាហរណ៍: AP Bill = $1,000; ចំនួនត្រឹមត្រូវ = $800; Debit Adjustment = $200	Apply Debit Adj ទៅ AP Bill	Finance Team	
2	AP Bill ខុសទាំងស្រុង	បង្កើត Debit Adj ស្មើនឹងចំនួន Bill ទាំងមូល	បង្កើត Debit Adj	F.D (VCL)	
		- Apply Debit Adj ទៅ AP Bill ដើម ហើយ Release	Apply / Release	F.D (VCL)	
		- បង្កើត AP Bill ថ្មីដែលមានព័ត៌មានត្រឹមត្រូវ	បង្កើត AP Bill ថ្មី	F.D (VCL)	
3	AP Bill បាន Paid រួចហើយ	ត្រូវ Void Payment និង Release ជាមុនសិន	Void Payment និង Release	F.D (VCL)	
		- បន្ទាប់មកបង្កើត Debit Adj ហើយ Apply ទៅ AP Bill ដើម	បង្កើត / Apply Debit Adj	F.D (VCL)	
		- បង្កើត AP Bill ថ្មី ប្រសិនបើចាំបាច់	បង្កើត AP Bill ថ្មី	F.D (VCL)	
4	Credit Adj. (AP) - Vendor គិតថ្លៃបន្ថែម	ប្រើ Credit Adj នៅពេល Vendor គិតថ្លៃបន្ថែម	បង្កើត Credit Adjustment	F.D (VCL)	
		- ឧទាហរណ៍: AP Bill = $1,000; Freight = $50; Total AP = $1,050	Apply Credit Adj ទៅ AP Bill	Finance Team	
VII. កែតម្រូវ AR ខុស					
1	AR Invoice បាន Released រួចហើយ - Amount លើស	ត្រូវបង្កើត Credit Memo ដើម្បីកាត់បន្ថយបំណុលរបស់ Customer	បង្កើត Credit Memo	F.D (VCL)	
		- ឧទាហរណ៍: AR Invoice = $1,000; តម្លៃត្រឹមត្រូវ = $800; Credit Memo = $200	Apply Credit Memo ទៅ AR Invoice	Finance Team	
2	AR Invoice ខុសទាំងស្រុង	បង្កើត Credit Memo ស្មើនឹង Invoice ទាំងមូល	បង្កើត Credit Memo	F.D (VCL)	
		- Apply Credit Memo ទៅ Invoice ដើម ហើយ Release	Apply / Release	F.D (VCL)	
		- បង្កើត AR Invoice ថ្មីដែលត្រឹមត្រូវ	បង្កើត AR Invoice ថ្មី	F.D (VCL)	
3	Customer បានបង់ប្រាក់រួចហើយ	ត្រូវ Void Payment និង Release ជាមុនសិន	Void Payment និង Release	F.D (VCL)	
		- បន្ទាប់មកបង្កើត Credit Memo ហើយ Apply ទៅ Invoice	បង្កើត / Apply Credit Memo	F.D (VCL)	
		- បង្កើត AR Invoice ថ្មី ប្រសិនបើចាំបាច់	បង្កើត AR Invoice ថ្មី	F.D (VCL)	
4	Debit Memo (AR) - Customer ត្រូវបង់បន្ថែម	ប្រើ Debit Memo នៅពេលត្រូវការបន្ថែមបំណុលឱ្យ Customer	បង្កើត Debit Memo	F.D (VCL)	
		- ឧទាហរណ៍: AR Invoice = $1,000; Freight ខ្វះ = $50; Total = $1,050	Apply Debit Memo ទៅ AR Invoice	Finance Team	`;

const adjustmentReasonCodes = [
  { variance: "Purchase Receipt", reasonCode: "PRADJSUT" },
  { variance: "Transfer", reasonCode: "STOCKVARIANCE" },
  { variance: "Issue", reasonCode: "BOQ" },
  { variance: "Sale", reasonCode: "SALE" },
];

const normalReasonCodes = [
  { variance: "Receipt to AP (Unbill)", reasonCode: "DRECEIPT" },
];

function parseAccessRightText(text) {
  const sections = [];
  let currentSection = null;
  let currentProcess = null;

  text.split(/\r?\n/).slice(2).forEach((line) => {
    const cells = line.split("\t");
    const [no = "", module = "", description = "", action = "", team = "", user = ""] = cells;

    if (/^[IVX]+\./.test(no)) {
      const normalizedId = no.startsWith("VI.") ? "post-ap-wrong" : no.startsWith("VII.") ? "post-ar-wrong" : no.replace(".", "").toLowerCase();
      const normalizedTitle = no.startsWith("VI.") ? "Post AP Wrong" : no.startsWith("VII.") ? "Post AR Wrong" : no.trim();
      currentSection = { id: normalizedId, title: normalizedTitle, processes: [] };
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

function isWrongEntrySection(title) {
  return title === "Post AP Wrong" || title === "Post AR Wrong";
}

function getWrongEntryContent(title) {
  if (title === "Post AP Wrong") {
    return {
      title: "Post AP Wrong",
      body: `1. បើ AP Bill បាន Released រួចហើយ
     ករណី៖ ចំនួនទឹកប្រាក់ខុស (Amount Incorrect)
     ត្រូវបង្កើត Debit Adj ដើម្បីកាត់បន្ថយ ឬបញ្ច្រាស (Reverse) ចំនួនដែលខុស។

ឧទាហរណ៍
  - AP Bill = $1,000
  - ចំនួនត្រឹមត្រូវ = $800
  - បង្កើត Debit Adjustment = $200

2. បើ AP Bill ខុសទាំងស្រុង
    ជំហាន
   - បង្កើត Debit Adjustment ស្មើនឹងចំនួន Bill ទាំងមូល។
   - Apply Debit Adjustment ទៅ AP Bill ដើម។
   - Release Debit Adjustment។
   - បង្កើត AP Bill ថ្មីដែលមានព័ត៌មានត្រឹមត្រូវ។

ឧទាហរណ៍
   - AP Bill ខុស = $1,000
   - Debit Adjustment = $1,000
   - បង្កើត AP Bill ថ្មីដែលត្រឹមត្រូវ

3. បើ AP Bill ត្រូវបានបង់ប្រាក់រួច (Paid)
  ជំហាន
  - Void Payment និង Release ជាមុនសិន។
  - ទើបបង្កើត Debit Adjustment។
  - Apply Debit Adjustment ទៅ AP Bill។
  - Release Debit Adjustment។
  - បង្កើត AP Bill ថ្មី ប្រសិនបើចាំបាច់។`,
    };
  }

  return {
    title: "Post AR Wrong",
    body: `1. បើ AR Invoice បាន Released រួចហើយ
  - ករណី៖ Amount លើស
  - ត្រូវបង្កើត Credit Memo ដើម្បីកាត់បន្ថយបំណុលរបស់ Customer។

ឧទាហរណ៍
  - AR Invoice = $1,000
  - តម្លៃត្រឹមត្រូវ = $800
  - បង្កើត Credit Memo = $200

2. បើ AR Invoice ខុសទាំងស្រុង
ជំហាន
  - បង្កើត Credit Memo ស្មើនឹង Invoice ទាំងមូល។
  - Apply ទៅ Invoice ដើម។
  - Release។
  - បង្កើត AR Invoice ថ្មីដែលត្រឹមត្រូវ។

ឧទាហរណ៍
  - Invoice ខុស = $1,000
  - Credit Memo = $1,000
  - បង្កើត Invoice ថ្មី

3. បើ Customer បានបង់ប្រាក់រួច
ជំហាន
  - Void Payment និង Release ជាមុនសិន។
  - រួចបង្កើត Credit Memo។
  - Apply Credit Memo ទៅ Invoice។
  - បង្កើត Invoice ថ្មី ប្រសិនបើចាំបាច់។`,
  };
}

function getSectionLabel(title) {
  if (title.includes("Request Fixed Asset")) {
    return "Request Fixed Asset";
  }

  if (title.includes("Post AP Wrong")) {
    return "Post AP Wrong";
  }

  if (title.includes("Post AR Wrong")) {
    return "Post AR Wrong";
  }

  return title.replace(/^[IVX]+\.\s*/, "");
}

function getSectionUpdatedDate(title) {
  if (title.includes("Petty Cash")) {
    return "22/05/2026";
  }

  if (title.includes("Post AP Wrong") || title.includes("Post AR Wrong")) {
    return "08/08/2026";
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
  const sections = useMemo(() => [
    ...parseAccessRightText(accessRightText),
    { id: "use-reason-code", title: "Use Reason Code", processes: [] },
  ], []);
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id || "");
  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0];
  const filteredProcesses = activeSection.processes;
  const isPettyCash = activeSection.title.includes("Petty Cash");
  const isWrongEntry = isWrongEntrySection(activeSection.title);
  const isReasonCodeSection = activeSection.id === "use-reason-code";

  return (
    <section className="acumatica-flow-tool" aria-labelledby="acumatica-flow-title">
      <h1 className="sr-only" id="acumatica-flow-title">Acumatica Process Flow</h1>
      <div className="acumatica-flow-meta-row">
        <div className="acumatica-flow-update">
          <span>Last update</span>
          <strong>{getSectionUpdatedDate(activeSection.title)}</strong>
        </div>
        {isPettyCash ? (
          <div className="acumatica-flow-remark-note">
            <span>Finance Manager: for Adjustment.</span>
            <span>Supervisor: for Non-Adjustment</span>
          </div>
        ) : null}
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

      {isReasonCodeSection ? (
        <div className="acumatica-reason-code-groups">
          {[
            { title: "Adjustment", reasonCodes: adjustmentReasonCodes },
            { title: "Normal", reasonCodes: normalReasonCodes },
          ].map(({ title, reasonCodes }) => (
            <section className="acumatica-reason-code-section" key={title}>
              <h2>{title}</h2>
              <div className="acumatica-reason-code-wrap">
                <table className="acumatica-reason-code-table">
                  <thead>
                    <tr>
                      <th scope="col">Transaction</th>
                      <th scope="col">Reason Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reasonCodes.map(({ variance, reasonCode }) => (
                      <tr key={variance}>
                        <td>{variance}</td>
                        <td>{reasonCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : isWrongEntry ? (
        <div className="acumatica-flow-notes">
          <article className={`acumatica-flow-note ${activeSection.title === "Post AP Wrong" ? "is-ap" : "is-ar"}`}>
            <div className="acumatica-flow-note-topline">
              <span className="acumatica-flow-note-kicker">{activeSection.title === "Post AP Wrong" ? "AP" : "AR"}</span>
              <h2>{getWrongEntryContent(activeSection.title).title}</h2>
            </div>
            <pre className="acumatica-flow-note-text">{getWrongEntryContent(activeSection.title).body}</pre>
          </article>
        </div>
      ) : (
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
                <th>Remark</th>
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
      )}
    </section>
  );
}
