'use babel';

export default function (contents) {
    let warnings = [];
    const map = [
        {regex: /\t/gi, val: '        '},
        {regex: /\r/gi, val: ''},

        {regex: /\bhg *= *make\("Hourglass"\);\s+/g, val: ''},

        {regex: /\b(alert_mgr|am) *= *make\("Alert_mgr"\);\s+/g, val: ''},
        {regex: /\b(alert_mgr|am|make\("Alert_mgr"\))\./g, val: 'Alert_mgr::'},

        {regex: /\b(str_util|su) *= *make\("(Str_util|String_util)"\);\s+/g, val: ''},
        {regex: /\b(str_util|su|make\("(Str_util|String_util)"\))\./g, val: 'Str_util::'},

        {regex: /\b(query|q) *= *make\("Query"\);\s+/g, val: ''},
        {regex: /\b(query|q|make\("Query"\))\./g, val: 'Query::'},

        {regex: /\bsorter *= *make\("Sorter"\);\s+/g, val: ''},
        {regex: /\b(sorter|make\("Sorter"\))\./g, val: 'Sorter::'},

        {regex: /\bobj_mgr *= *make\("Object_mgr"\);\s+/g, val: ''},
        {regex: /\b(obj_mgr|make\("Object_mgr"\))\./g, val: 'Object_mgr::'},

        {regex: /\b(request_mgr|req_mgr|rm) *= *make\("Request_mgr"\);\s+/g, val: ''},
        {regex: /\b(request_mgr|req_mgr|rm|make\("Request_mgr"\))\./g, val: 'Request_mgr::'},

        {regex: /\b(list_util|lu) *= *make\("List_util"\);\s+/g, val: ''},
        {regex: /\b(list_util|lu|make\("List_util"\))\./g, val: 'List_util::'},

        {regex: /\b(prop_extractor|pe|ex|px) *= *make\("Prop_extractor"\);\s+/g, val: ''},
        {regex: /\b(prop_extractor|pe|ex|px|make\("Prop_extractor"\))\./g, val: 'List_util::'},

        {regex: /\b(date_util|du) *= *make\("Date_util"\);\s+/g, val: ''},
        {regex: /\b(date_util|du|make\("Date_util"\))\./g, val: 'Date_util::'},

        {regex: /\bcopier *= *make\("Copier"\);\s+/g, val: ''},
        {regex: /\b(copier|make\("Copier"\))\./g, val: 'Copier::'},

        {regex: /\bmake\("Script_func"\)\.load\(/g, val: 'make\("Script_func",'},
    ];

    map.forEach(item => (contents = contents.replace(item.regex, item.val)));

    if(!/\bmake\("Loader"\)/g.test(contents)) {
        contents = contents.replace(/\b(loader|m_loader) *= *make\("M_loader"\);\s+/g, '');
        contents = contents.replace(/\b(loader|m_loader|make\("M_loader"\))\./g, 'M_loader::');
    } else {
        warnings.push(`This file contains instances of 'Loader'. Manual replacements with 'M_loader' are required.`);
    }

    if(/\bset_message/g.test(contents)) {
         warnings.push(`This file contains outdated calls to 'set_message'. Consider replacing them with 'add_message'.`);
    }

    return { warnings, text: contents };
}
