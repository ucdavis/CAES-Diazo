MyApp = {};
MyApp.spreadsheetData = [];
MyApp.headerData = [
    { "sTitle": "Researcher Name" }, { "sTitle": "Campus/ College" }, 
    { "sTitle": "Department/ Program"}, { "sTitle": "Researcher Title"}, 
    { "sTitle": "Website"}, { "sTitle": "Email"}, 
    { "sTitle": "Research Area"}
];

MyApp.ResearchAreaCategories = { 
    "researchareapopulations": { name: "Populations defined by…", values: [] }, 
    "researcharealifephase": { name: "Life Phase", values: [] }, 
    "researchareaother": { name: "Other", values: [] } 
};

MyApp.filterIndexes = { "colleges": 1, "departments": 2, "researchtitles": 3, "researcharea" : 6 };
MyApp.Colleges = [], MyApp.ResearchTitles = [], MyApp.Departments = [];

String.prototype.trunc = function (n) {
    return this.substr(0, n - 1) + (this.length > n ? '&hellip;' : '');
};

$(function () {
    var url = "https://spreadsheets.google.com/feeds/list/0AhTxmYCYi3fpdHI5RnliaG1yMGZxeEVTYnJXc1Fxb3c/1/public/values?alt=json-in-script&callback=?";
    $.getJSON(url, {}, function (data) {
        $.each(data.feed.entry, function (key, val) {
            var college = val.gsx$campuscollege.$t;
            var researchTitle = val.gsx$researchertitle.$t;
            var department = val.gsx$departmentprogram.$t;
            var website = "<a target='_blank' href='" + val.gsx$website.$t + "'>" + val.gsx$website.$t.trunc(25) + "</a>";
            var email = "<a href='mailto:" + val["gsx$e-mail"].$t + "'>" + val["gsx$e-mail"].$t + "</a>";

            var allResearchAreas = val.gsx$researchareapopulations.$t + ';' + val.gsx$researcharealifephase.$t + ';' + val.gsx$researchareaother.$t;

            MyApp.spreadsheetData.push(
                [
                    GenerateResearcherColumn(val), college,
                    department, researchTitle,
                    website, email,
                    allResearchAreas
                ]);

            if ($.inArray(college, MyApp.Colleges) === -1) {
                MyApp.Colleges.push(college);
            }

            if ($.inArray(researchTitle, MyApp.ResearchTitles) === -1 && researchTitle.length !== 0) {
                MyApp.ResearchTitles.push(researchTitle);
            }

            if ($.inArray(department, MyApp.Departments) === -1 && department.length !== 0) {
                MyApp.Departments.push(department);
            }

            $.each(MyApp.ResearchAreaCategories, function (researchAreaName, researchAreaCollection) {
                var researchArea = val["gsx$" + researchAreaName].$t;

                //Add the keywords, which are semi-colon separated. First trim them and then replace the CRLF, then split.
                $.each(researchArea.trim().replace(/^[\r\n]+|\.|[\r\n]+$/g, "").split(';'), function (key, val) {
                    val = val.trim(); //need to trim the semi-colon separated values after split
                    if ($.inArray(val, researchAreaCollection.values) === -1 && val.length !== 0) {
                        researchAreaCollection.values.push(val);
                    }
                });

                researchAreaCollection.values.sort();
            });
        });

        MyApp.Colleges.sort();
        MyApp.Departments.sort();

        createDataTable();
        addFilters();
        researcherPopup();
    });
})

function hideUnavailableDepartments(){
    var fileredData = MyApp.oTable._('tr', {"filter":"applied"});

    //Get departments available after the filters are set
    MyApp.Departments = [];
    $.each(fileredData, function (key, val) {
        var department = val[MyApp.filterIndexes["departments"]];

        if ($.inArray(department, MyApp.Departments) === -1 && department.length !== 0) {
                MyApp.Departments.push(department);
        }
    });

    $(":checkbox", "#departments").each(function () {
        //if a checkbox isn't in the list of available departments, hide it
        if ($.inArray(this.name, MyApp.Departments) === -1) {
            $(this).parent().css("display", "none");
        } else {
            $(this).parent().css("display", "block");
        }
    });
}

function addFilters(){
    var $colleges = $("#colleges");
    
    $.each(MyApp.Colleges, function (key, val) {
        $colleges.append('<li><label><input type="checkbox" name="' + val + '"> ' + val + '</label></li>');
    });

    var $departments = $("#departments");
    
    $.each(MyApp.Departments, function (key, val) {
        $departments.append('<li><label><input type="checkbox" name="' + val + '"> ' + val + '</label></li>');
    });

    //Create a select box with all research areas by category
    var $researcharea = $("#researcharea");

    var researchSelect = "<select id='researchfilter'><option value=''>--No Research Area Filter--</option>";

    $.each(MyApp.ResearchAreaCategories, function (category, researchAreaCollection) {
        researchSelect += "<optgroup label='" + researchAreaCollection.name + "'>";
        $.each(researchAreaCollection.values, function (k, researchArea) {
            researchSelect += "<option>" + researchArea + "</option>";
        });
        researchSelect += "</optgroup>";
    });

    researchSelect += "</select>";

    $researcharea.append(researchSelect);

    $("#researcharea").on("change", "#researchfilter", function (e) {
        var selected = $("#researchfilter").val();

        //can match anywhere in keyword list, replace open/close parens with leading escape slash
        var filterRegex = "(" + selected.replace("(", "\\(").replace(")", "\\)") + ")";

        MyApp.oTable.fnFilter(filterRegex, MyApp.filterIndexes["researcharea"], true, false);
        hideUnavailableDepartments();
        displayCurrentFilters();
    });

    $(".filterrow").on("click", "ul.filterlist", function (e) {
        var filterRegex = "";
        var filterName = this.id;
        var filterIndex = MyApp.filterIndexes[filterName];
        
        var filters = [];
        $("input", this).each(function (key, val) {
            if (val.checked) {
                if (filterRegex.length !== 0) {
                    filterRegex += "|";
                }

                filterRegex += "(^" + val.name + "$)"; //Use the hat and dollar to require an exact match                
            }
        });

        MyApp.oTable.fnFilter(filterRegex, filterIndex, true, false);
        hideUnavailableDepartments();
        displayCurrentFilters();
    });

    $("#clearfilters").click(function (e) {
        e.preventDefault();

        $(":checkbox", "ul.filterlist").each(function () {
            this.checked = false;
        });

        $("#researchfilter").val(0);

        $("ul.filterlist").click();
    });
}

function researcherPopup(){
    $("#spreadsheet").popover({ 
        selector: '.researcher-popover',
        trigger: 'hover'
    });
}

function GenerateResearcherColumn(val /* entry value from spreadsheet */){
    var name = val.gsx$researchername.$t;
        
    //var website = "<a target='_blank' href='" + val.gsx$website.$t + "'>" + val.gsx$website.$t + "</a>";
    //var email = "<a href='mailto:" + val["gsx$e-mail"].$t + "'>" + val["gsx$e-mail"].$t + "</a>";
    var research = val.gsx$research.$t;

    var content = research; //could expand content later
    var researcher = "<a href='#' class='researcher-popover' data-toggle='popover' data-content='" + research + "' data-original-title='" + name + "'>" + name + "</a>";
        
    return researcher;
}

function displayCurrentFilters(){
    var $filterAlert = $("#filters");
    var researchFilter = $("#researchfilter").val();
    var filters = "";

    if (researchFilter){
        filters += "<strong>" + researchFilter + "</strong>";
    }

    $(":checked", "ul.filterlist").each(function () {
        if (filters.length !== 0){
            filters += " + "
        }
        filters += "<strong>" + this.name + "</strong>";        
    });

    if (filters.length !== 0){     
        var alert = $("<div class='alert alert-info'><strong>Filters</strong><p>You are filtering on " + filters + "</p></div>")

        $filterAlert.html(alert);   
    } else{
        $filterAlert.html(null);  
    }

    $filterAlert[0].scrollIntoView( true );
}

function createDataTable() {
    //Create a sorter that uses case-insensitive html content
    jQuery.extend(jQuery.fn.dataTableExt.oSort, {
        "link-content-pre": function (a) {
            return $(a).html().trim().toLowerCase();
        },

        "link-content-asc": function (a, b) {
            return ((a < b) ? -1 : ((a > b) ? 1 : 0));
        },

        "link-content-desc": function (a, b) {
            return ((a < b) ? 1 : ((a > b) ? -1 : 0));
        }
    });

    MyApp.oTable = $("#spreadsheet").dataTable({
        "aoColumnDefs": [
            { "sType": "link-content", "aTargets": [ 0, 4, 5 ] },
            { "bVisible": false, "aTargets": [ -1 ] } //hide the keywords column for now (the last column, hence -1)
        ],
        "iDisplayLength": 20,
        "bLengthChange": false,
        "aaData": MyApp.spreadsheetData,
        "aoColumns": MyApp.headerData
    });
}