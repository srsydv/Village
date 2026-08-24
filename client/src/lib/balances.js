export function computeBalances(members, transactions) {
  const map = new Map();

  for (const m of members) {
    map.set(m.id, { savingsPaise: 0, loanOutstandingPaise: 0 });
  }

  for (const t of transactions) {
    const row = map.get(t.memberId);
    if (!row) continue;
    if (t.type === "savings") row.savingsPaise += t.amountPaise;
    if (t.type === "loan_out") row.loanOutstandingPaise += t.amountPaise;
    if (t.type === "loan_repay") {
      row.loanOutstandingPaise = Math.max(
        0,
        row.loanOutstandingPaise - t.amountPaise,
      );
    }
  }

  const balances = members.map((m) => {
    const row = map.get(m.id);
    return {
      memberId: m.id,
      displayName: m.displayName,
      avatarKey: m.avatarKey,
      savingsPaise: row.savingsPaise,
      loanOutstandingPaise: row.loanOutstandingPaise,
    };
  });

  const groupSavingsPaise = balances.reduce((s, b) => s + b.savingsPaise, 0);
  const groupLoanOutstandingPaise = balances.reduce(
    (s, b) => s + b.loanOutstandingPaise,
    0,
  );

  let cashInHandPaise = 0;
  for (const t of transactions) {
    if (t.type === "savings" || t.type === "loan_repay") {
      cashInHandPaise += t.amountPaise;
    }
    if (t.type === "loan_out") cashInHandPaise -= t.amountPaise;
  }

  return {
    balances,
    groupSavingsPaise,
    groupLoanOutstandingPaise,
    cashInHandPaise,
  };
}
