/*
| __BEGIN_LICENSE__
| Copyright (C) 2008-2010 United States Government as represented by
| the Administrator of the National Aeronautics and Space Administration.
| All Rights Reserved.
| __END_LICENSE__
*/

var geocamMapSetLib = geocamMapSetLib || {};

// UI-Data mapping: dataMap[htmlIdx] = jsonIdx
// Use the array dataMap as a lookup table for mapping the layer entries in
// the mapset editor back to the mapSetManager.mapSet.children[] array
//
geocamMapSetLib.dataMap = new Array();

// geocamMapSetLib.mapLibraryList will be populated with content
// downloaded from the map library url.
//
geocamMapSetLib.mapLibraryList = new Array();

// MapSetManager(spec, map, editorDivId, opts)
//
// Constructor that creates and displays a map set. It returns a MapSetManager
// object, the status attribute of which indicates whether the mapSetJSON has
// loaded.
//
// @spec is MapSetJSON document url string
// @map is a Google API v3 map
// @editorDivId is the id of an HTML div where the layer editor interface
// widget will be displayed.
// @opts passes in customization options (to be defined later).
//
//
geocamMapSetLib.MapSetManager = function (spec, map, editorDivId, opts) {

    // TODO: input validation (google search 'javascript function type
    // checking', 'javascript function args', 'javascript typeof')
    //
    
    mapSetManager = new Object();
    mapSetManager.opts = opts;
    mapSetManager.status = 'LOADING';
    mapSetManager.url = spec;
    mapSetManager.editorDivId = editorDivId;
    mapSetManager.googleMap = map;
    mapSetManager.mapLayers = [];   // use jsonId to index

    // make mapSetManager retrievable via global geocamMapSetLib instance.
    // It is used by the components inside the the mapset editor.
    geocamMapSetLib.managerRef = mapSetManager;


    // load the mapSetJSON asynchrously
    //
    $.getJSON(spec, function(obj) {
        mapSet = obj;
        
        mapSetManager.mapSet = mapSet;
        mapSetManager.status = 'FINISHED_LOADING';

        mapSetManager.drawEditorDivAndMapCanvas();

        // function to check editing mode status
        //
        mapSetManager.isEditable = function() {
            return !$('#mapLayerList').sortable("option", "disabled");
        }

        // function to disable the editing mode
        //
        mapSetManager.disableEditing = function () {
            // disable sorting
            $('#mapLayerList').sortable({disabled: true});

            // remove arrow-icon and draggable frame to each entry
            $('#mapLayerList span').removeClass('ui-icon ui-icon-arrowthick-2-n-s');
            $('.layerEntry').removeClass('ui-state-default');

            // disable remove button
            $('.layer-entry-right').hide();

            // disable save button
            setButtonDisabled($('#save'), true);
        }

        // function to enable the editing mode
        //
        mapSetManager.enableEditing = function (savedUrl) {
            // enable sorting 
            $('#mapLayerList').sortable({disabled: false});

            // Add arrow-icon and draggable frame to each entry
            $('#mapLayerList span').addClass('ui-icon ui-icon-arrowthick-2-n-s');
            $('.layerEntry').addClass('ui-state-default');

            // enable remove button
            $('.layer-entry-right').show();
            $('.removeButton').button('option','icons','{primary:null, secondary:null}');
            

            // disable save button
            setButtonDisabled($('#save'), false);
        }

        // function to create a mapSetJSON from the current state
        // (i.e., after editing). "What You See Is What You Get"
        //
        mapSetManager.getMapsetState = function () {
            var uiLayers = new Array();

            // extract the state from the HTML Editor View
            for (htmlIdx = 0; htmlIdx < geocamMapSetLib.dataMap.length; htmlIdx++) {
                // id of the json child in the ui 
                //
                var jsonIdx = geocamMapSetLib.dataMap[htmlIdx];

                // add the child at its new position based on the ui
                //
                uiLayers[htmlIdx] = mapSet.children[jsonIdx];

                // save the show status if enabled
                //
                if ($('.layer-entry-left > input').get(htmlIdx).checked) {
                    uiLayers[htmlIdx].show = 'true';
                } else {
                    delete uiLayers[htmlIdx].show;
                }                
            }

            // update the mapset json object with the new layer content
            //
            mapSet.children = uiLayers;                            
  	    
            // update mapLayers[] : remove the deleted entries (i.e. undefined)
            var mapLayers = this.mapLayers;
            var idx = 0;
            while (idx<mapLayers.length) {
                var entry = mapLayers[idx];
                if (entry == undefined) {
                    mapLayers.splice(idx, 1); // remove one element
                    //console.log(mapLayers);
                }
                else {
                    idx += 1;
                }
            }

            // Redraw the Editor Div.
            // pre-state: the ids in the html is out of sync with the new json!
            //       
            // Alternative for redrawing: update jsonId related components
            //     the metadata tag id
            //     the checkbox click() handler
            //     the remove-layer button click() handler
            this.drawEditorDivAndMapCanvas();            
                
            // the editor view should match the json state after redrawing
            // i.e., dataMap[htmlIdx] htmlIdx
            $('.layerEntry').each(function (i, obj) {
                geocamMapSetLib.dataMap[i] = i;
            })

            console.log("new json content: " + JSON.stringify(mapSet));
            return mapSet;
        }
    });  // end of asynchronous execution, i.e., $.getJSON() method.

    // Initialize the libraryDiv
    //
    $.getJSON(mapSetManager.opts.libraryUrl, function(obj) {
        // store the map layer library as globally retrievable
        geocamMapSetLib.mapLibraryList = obj;
        
        mapSetManager.drawLibraryDiv();
    });

    // bind the function drawEditorDivAndMapCanvas() and drawLibraryDiv() 
    // needed in the asynchronous part of the initialization.
    mapSetManager.drawEditorDivAndMapCanvas = drawEditorDivAndMapCanvas;

    mapSetManager.drawLibraryDiv = drawLibraryDiv;

    return mapSetManager;
}



// bindNewLayerToGoogleMap(layerEntry)
//
// Helper function for drawEditorDivAndMapCanvas. It bind the map set entry 
// (i.e., @layerEntry) to the mapSetManager.googleMap
// 
// Return value is the index of the new map layer in 
// geocamMapSetLib.managerRef.mapLayers.
//
// @layerEntry is a mapSetJSON layer object (expected fields: url, show).
//
// Notes: It retrieve the googleMap object via geocamMapSetLib.managerRef.
//
function bindNewLayerToGoogleMap(layerEntry) {
    if (settings.GEOCAM_MAP_SET_DISABLE_MAPS) return;

    var googleMap = geocamMapSetLib.managerRef.googleMap;
    var mapLayers = geocamMapSetLib.managerRef.mapLayers;
    var newLayerIdx = mapLayers.length;

    // add map layer to global array for map management    
    mapLayers[newLayerIdx] = new google.maps.KmlLayer(layerEntry.url, {preserveViewport: true});
            
    // also load the layer on the map if it is enabled
    if (typeof layerEntry.show !== 'undefined') {
        if (layerEntry.show.toLowerCase() == 'true') {
            mapLayers[newLayerIdx].setMap(googleMap);
            console.log('Showing map:' + layerEntry.url);
        }    
    }

    return newLayerIdx;
}



// addLibraryLayerToMapSet(mapLibraryLayer)
//
// Helper function for drawEditorDivAndMapCanvas.
// It returns the mapSet.children[] index for the newly-added map layer entry corresponding
// to the @mapLibraryLayer.
//
// @mapLibraryLayer is a map layer entry following the format of 
//  geocamMapSetLib.mapLibraryList.
// 
// Notes: It retrieves the MapSetJSON via geocamMapSetLib.managerRef.mapSet.
//
function addLibraryLayerToMapSet(mapLibraryLayer) {
    var mapSetList = geocamMapSetLib.managerRef.mapSet.children;
    var newItemIdx = mapSetList.length;

    mapSetList.push(mapLibraryLayer);
    
    // debugging
    console.log('New item added, mapSetJson.children[' + newItemIdx + ']:' 
                + mapSetList[newItemIdx].name);
    
    return newItemIdx;
}



// composeLayerEntry(layer, jsonId)
//
// Helper function for drawEditorDivAndMapCanvas. 
// It returns the HTML for the layer entry in the custom MapSet. 
//
// @layer is the MapSetJSON layer object (expected fields: name, show)
// @jsonId is the index of the corresponding child entry in the 
//  mapSetManager.mapSet.children[] array.
// 
function composeLayerEntry(layer, jsonId) {
    var mapSetEntryHtml = [];
    var checkbox;

    // if the layer is set to 'show' by default, the layer
    // should be selected on the mapset editor
    //
    if (typeof layer.show !== 'undefined') {
        if (layer.show.toLowerCase() == 'true') {
            checkbox = '<input type="checkbox" id="showLayer_' + jsonId + '" checked="checked"></input>';
        } 
    }
    else {
            checkbox = '<input type="checkbox" id="showLayer_' + jsonId + '"></input>';
    }
    

    // create mapset entry content
    //
    mapSetEntryHtml.push
        ('<div class="layerEntry ui-state-default">'
         + '<table width="100%"><tr valign="top">'
         + '<td class="layer-entry-left">' + checkbox + '</td>'
         + '<td class="layer-entry-mid"><label for="showLayer_' + jsonId + '">' + layer.name + '</label></td>'
         + '<td class="layer-entry-right"><span id="remove_' + jsonId + '"></span></td>'
         + '</tr></table>'
         + '<div class="metadata" id="' + jsonId + '" style="visibility:hidden"' + '></div>'
         + '</div>');

    return mapSetEntryHtml.join('');    
}



// initRemoveButton(jsonId)
//
// Helper function for drawEditorDivAndMapCanvas.
// It assigns the button attributes to the "#remove_{jsonId}" DOM element and
// bind the Click event handler that removes the map layer entry.
//
// @jsonId is the index of the corresponding child entry in the 
//  mapSetManager.mapSet.children[] array.
//
// Notes: the handler relies on geocamMapSetLib.managerRef.mapLayers[].
// 
function initRemoveButton(jsonId) {
    var buttonId = '#remove_' + jsonId;

    $(buttonId).button({
        text: false
    }).click(function() { 
         // onclick handler: remove the layer entry
         console.log('removing map layer: ' + buttonId);

         var mapLayers = geocamMapSetLib.managerRef.mapLayers;

         // unbind the GoogleMap if it is enabled.
         var show = $('#showLayer_'+jsonId).attr('checked');
         if (show) {
             console.log('It is on show.');             
             mapLayers[jsonId].setMap(null);
         }

         // remove the map layer from DOM
         $(this).parents(".layerEntry").remove();

         // look for htmlId

         // update dataMap[], i.e., Mapping: htmlId -> jsonId
         // 
         var dataMap = geocamMapSetLib.dataMap;
         var htmlIdx = dataMap.indexOf(jsonId);
         if (htmlIdx == -1) {
              console.log('Error: failed to find JsonId ' + jsonId + '. ' + htmlIdx + ' returned.');
              console.log(dataMap);
         }
         else {
              // remove the dataMap entry
              dataMap.splice(htmlIdx, 1);  
              console.log(dataMap);
         }

         // defer shrinking the mapLayers[] to when mapSetManager.mapSet gets
         // updated, i.e., in mapSetManager.getMapsetState()
         // 
         // "delete array" only marks that entry as undefined, which serves
         // as a marker for removed entry in mapLayers.
         delete mapLayers[jsonId];

         //console.log('--- mapLayer[] state after entry removed ---');
         //console.log('Note:the deleted layer entry is marked as undefined.');
         //console.log(mapLayers);

    }).addClass("removeButton ui-icon ui-icon-close").width("17px");

}



// connectMaplayerCheckboxToGoogleMap(mapEntry, jsonId)
//
// Helper function for drawEditorDivAndMapCanvas. 
// It initiates the checkbox "change" event handler. 
//
// @mapEntry is the map layer entry from the map library. (expect field: name)
// @jsonId is the index of the corresponding child entry in the 
//  mapSetManager.mapSet.children[] array.
//
// Note: the mapSetManager.mapLayers[] array is indexed by jsonId.
//
function connectMaplayerCheckboxToGoogleMap(mapEntry, jsonId) {

    $('#showLayer_' + jsonId).change(function (layer) {
        return function () {
            var mapLayers = geocamMapSetLib.managerRef.mapLayers;
            var map = geocamMapSetLib.managerRef.googleMap;            

            var show = $(this).attr('checked');
            if (show) {
                console.log("showing layer " + layer.name);
                if (!settings.GEOCAM_MAP_SET_DISABLE_MAPS) {
                    mapLayers[jsonId].setMap(map);
                }
            } else {
                console.log("hiding layer " + layer.name);
                if (!settings.GEOCAM_MAP_SET_DISABLE_MAPS) {
                    mapLayers[jsonId].setMap(null);
                }
            }
        }
    }(mapEntry));

}

// mapSetManager.drawEditorDivAndMapCanvas()
//
// Clean the editorDiv and draw the html content based on the jsonObj
//
// @status is the indicator whether the @mapSet is loaded.
// @mapSet is the object representation of the MapSetJson document
// @editorDivId is the ID of the editorDiv. Usually, it will be used with
// the mapSetManager.editorDivId.
// @googleMap is the GoogleMap map object
// @mapLayers is the array of map layers binding to the @googleMap
//
// This function also writes the following global variables
//     geocamMapSetLib.dataMap[];
//
function drawEditorDivAndMapCanvas() {

    // return if mapSet is not ready
    if (this.status != 'FINISHED_LOADING') {
        console.log('Fail to execute drawEditorDivAndMapCanvas. mapSetManager.status is ' + this.status);
        return;
    }

    var mapLayers = this.mapLayers;
    var map = this.googleMap;

    // unpopulate all layers on the map
    while (mapLayers.length>0) {
        var m = mapLayers.pop();
        m.setMap(null);
        //console.log('Clearing layer ' + (mapLayers.length));
    }

    var mapSetViewHtml = [];

    // add buttons and name 
    //
    var mapSetName = "Unnamed Mapset";
    if (this.mapSet.hasOwnProperty('name')) {
        mapSetName = this.mapSet.name;
    }
    mapSetViewHtml.push('<label id="mapSetName">' + mapSetName + '</label><br>');
    mapSetViewHtml.push('<button id="save" type="button">Save</button>');
    mapSetViewHtml.push('<img id="activityIndicator"' +
                        'src="' + STATIC_URL + 'geocamMapSet/images/indicator.white.gif"' +
                        'style="display:none"/>');
    mapSetViewHtml.push('<label id="activityStatus" style="display:none">' +
                        'save complete.</label>');

    mapSetViewHtml.push('<div id="mapLayerList">');

    $.each(this.mapSet.children, function (i, layer) {
        // initially, there will be a direct relationship between the JSON
        // order and the html display order
        //
        var htmlId = i;
        var jsonId = i;
        var checkbox;

        // build the { htmlId : jsonId } mapping to track reordering
        // operations.
        geocamMapSetLib.dataMap[htmlId] = jsonId;

        //console.log(i, jsonId, htmlId);
        //console.log(layer.url);

        var layerEntryHtml = composeLayerEntry(layer, jsonId);
        mapSetViewHtml.push(layerEntryHtml);

        // add map layer to global array for map management
        //
        if (!settings.GEOCAM_MAP_SET_DISABLE_MAPS) {
            mapLayers[i] = new google.maps.KmlLayer(layer.url, {preserveViewport: true});
            
            // also load the layer on the map if it is enabled
            //
            if (typeof layer.show !== 'undefined') {
                if (layer.show.toLowerCase() == 'true') {
                    mapLayers[i].setMap(map);
                }
            }
        }
    });  // end of .each() loop

    mapSetViewHtml.push('</div>');
    mapSetViewHtml.push('<button id="importLayer">Import Layer</button>');

    $(this.editorDivId).html(mapSetViewHtml.join(''));

    importLayerButton = $('#importLayer');
    importLayerButton.button();
    importLayerButton.click(function () {
	var dialogDiv = $('#dialogDiv');
	dialogDiv.attr('title', 'Import Layer');
	// this html was copy-and-pasted from the django-rendered form
	dialogDiv.html
	('<form id="importLayerForm" method="post" action=".">'
	 + '<table>'
	 + '<tr><th><label for="id_url">Url:</label></th><td><input id="id_url" type="text" name="url" maxlength="200" /></td></tr>'
	 + '<tr><th><label for="id_name">Name:</label></th><td><input id="id_name" type="text" name="name" maxlength="255" /></td></tr>'
	 + '</table>'
	 + '<input id="importLayerSubmit" type="submit" value="Save"/>'
	 + '</form>');
	$('#importLayerForm').submit(function () {
	    var text = JSON.stringify($(this).serializeObject());
	    console.log(text);
	    $.ajax(geocamMapSetLib.managerRef.opts.createLayerUrl, text,
		   function () {
		       console.log('posted');
		   });
	    return false;
	});
	dialogDiv.dialog({modal: true});
    });

    // add callback for button click here
    //
    $('#save').button();
    $('#save').click(function() {

        m = geocamMapSetLib.managerRef.getMapsetState();

        //setButtonDisabled($('#save'), true);
        $('#activityIndicator').show();

        $.post(geocamMapSetLib.managerRef.url, JSON.stringify(m), function(data) {
                //setButtonDisabled($('#save'), false);
                $('#activityIndicator').hide();

                $('#activityStatus').show('slow', function() {
                    setTimeout("$('#activityStatus').hide()", 1000);
                })
        })
    })
    
    // make the layer list sortable
    //
    $('#mapLayerList').sortable({
        // show placeholder during sorting 
        // TODO: enlage the box in ui-state-highlight styling
        placeholder: 'ui-state-highlight',

        // Event handler for the change of state in mapset editor, i.e.,
        //     Add a new layer
        //     Reorder a layer
        //
        stop: function(event, ui) {
            // Handle adding new entry and sorting separately
            //
            if (ui.item.hasClass('libraryEntry')) {
                // retrieve the map layer from the mapLibraryList
                var mapLibraryList = geocamMapSetLib.mapLibraryList;
                var libIdx = ui.item.find('.metadata').attr('id');                
                var libEntry = mapLibraryList[libIdx];
                
                // add item to the mapSet.children and retrieve its index
                var jsonId = addLibraryLayerToMapSet(libEntry);

                // generate the map set entry HTML and update the placeholder 
                var newEntryHtml = composeLayerEntry(libEntry, jsonId);
                ui.item.replaceWith(newEntryHtml);

                // create the Google map binding to the new entry and initiate
                // the checkbox "change" event handler.
                bindNewLayerToGoogleMap(libEntry);
                connectMaplayerCheckboxToGoogleMap(libEntry,jsonId);

                // create the "remove layer" button
                initRemoveButton(jsonId);

                console.log('Add new entry from lib #' + libIdx);
            }
            else {
                console.log('Sort only');
            }

            // rebuild the dataMap[] based on the updated Html Editor View
            // 
            $('.layerEntry').each(function (i, obj) {
                var jsonId = $(obj).find('.metadata').attr("id");
                // Don't assign string to dataMap!!!
                geocamMapSetLib.dataMap[i] = parseInt(jsonId, 10); 
            });
            
            // for debugging
            dumpDataMap(geocamMapSetLib.dataMap);
        }
    });

    // attach handlers to each layer's components:
    // (1) checkbox handler will run the layer's setMap function to
    // add/remove it from the map.
    // (2) "remove-layer" button handler will remove the associate 
    // map layer entry.
    $.each(mapSet.children, function (i, layer) {
        connectMaplayerCheckboxToGoogleMap(layer, i, i);

        initRemoveButton(i);
    });
}



// mapSetManager.drawLibraryDiv() 
// 
// Clean the libraryDiv and draw the html content based on the map layer
// library in JSON format
//
// Dependencies:
// @geocamMapSetLib.mapLibraryList is the object representation of a set of map layers.
// @this.libraryDivId is the ID of the libraryDiv. 
//
function drawLibraryDiv() {
    
    var mapLibraryList = geocamMapSetLib.mapLibraryList;
    var mapLibraryViewHtml = [];

    mapLibraryViewHtml.push('<div id="mapLibraryList">');

    // iterate through the mapLibraryList and create the html entries
    //
    $.each(mapLibraryList, function (i, layer) {
        mapLibraryViewHtml.push('<div class="libraryEntry">' 
            + layer.name
            + '<div class="metadata" id="' + i + '" style="visibility:hidden"' + '></div>'
            + '</div>');
        console.log( "library layer " + i + ": " + layer.name );
    });

    mapLibraryViewHtml.push('</div>');

    // inject the html content to the libraryDiv
    //
    $(this.opts.libraryDiv).html(mapLibraryViewHtml.join(''));

    // assign draggable attribute to each libraryEntry 
    //
    // TODO: Synchronize is needed to ensure #mapLayerList is created.
    //       Alternatively, invoke drawLibraryDiv() after finishing
    //       drawEditorDivAndMapCanvas() explicitly.
    //
    $('.libraryEntry').draggable({
            connectToSortable: '#mapLayerList',
            helper: 'clone',
            revert: 'invalid', 
            revertDuration: 100
    });
}



// utility function to dump the current state of the ui for debugging
//
function dumpDataMap(dataMap) {
    for (i=0; i < dataMap.length; i++) {
        console.log("htmlID=" + i + " jsonId="+ dataMap[i]);
    }
}


// toggle a button as enabled or disabled
//
function setButtonDisabled(button, disabled) {
    if (disabled) {
        button.button('disable');
    } else {
        button.button('enable');
    }
}

// FIX: this should probably be in a different file
jQuery.fn.serializeObject = function() {
    var arrayData, objectData;
    arrayData = this.serializeArray();
    objectData = {};

    $.each(arrayData, function() {
	var value;

	if (this.value != null) {
	    value = this.value;
	} else {
	    value = '';
	}

	if (objectData[this.name] != null) {
	    if (!objectData[this.name].push) {
		objectData[this.name] = [objectData[this.name]];
	    }

	    objectData[this.name].push(value);
	} else {
	    objectData[this.name] = value;
	}
    });

    return objectData;
};
