(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TERMS = api.TERMS;
})(typeof self !== 'undefined' ? self : this, function () {
  // The predefined gender-specific terms and their suggested neutral alternatives.
  const TERMS = [
    { term: 'chairman', suggestion: 'chairperson' },
    { term: 'chairmen', suggestion: 'chairpersons' },
    { term: 'policeman', suggestion: 'police officer' },
    { term: 'policemen', suggestion: 'police officers' },
    { term: 'policewoman', suggestion: 'police officer' },
    { term: 'fireman', suggestion: 'firefighter' },
    { term: 'firemen', suggestion: 'firefighters' },
    { term: 'stewardess', suggestion: 'flight attendant' },
    { term: 'mankind', suggestion: 'humankind' },
    { term: 'businessman', suggestion: 'businessperson' },
    { term: 'salesman', suggestion: 'salesperson' },
    { term: 'spokesman', suggestion: 'spokesperson' },
    { term: 'mailman', suggestion: 'mail carrier' },
    { term: 'manpower', suggestion: 'workforce' },
    { term: 'waitress', suggestion: 'server' },
    { term: 'cleaning lady', suggestion: 'cleaner' },
    { term: 'he', suggestion: 'they' },
    { term: 'she', suggestion: 'they' },
    { term: 'him', suggestion: 'them' },
    { term: 'her', suggestion: 'them / their' },
    { term: 'his', suggestion: 'their / theirs' },
    { term: 'hers', suggestion: 'theirs' },
    { term: 'himself', suggestion: 'themself' },
    { term: 'herself', suggestion: 'themself' },
  ];
  return { TERMS };
});
