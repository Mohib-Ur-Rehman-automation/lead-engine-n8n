// Always return one clean result per contact (new or existing) on the main output.
return $input.all().map((it, i) => {
  const r = { ...$('CRM: shape result').itemMatching(i).json };
  delete r.init_props;
  return { json: r };
});
