require.config({
    shim: {
        "splunkjs/mvc/d3chart/d3/d3.v2": {
            deps: [],
            exports: "d3"
        },
    }
});

// Bubbles!
// this displays information as different 'bubbles,' their unique values represented with
// the size of the bubble.
// supports drilldown clicks

// available settings:
// - nameField: the field to use as the label on each bubble
// - valueField: the field to use as the value of each bubble (also dictates size)
// - groupingField: the field to use for grouping similar data (usually the same field as nameField)

// ---expected data format---
// a splunk search like this: source=foo | stats count by artist_name, track_name

define(function(require, exports, module) {

    var _ = require('underscore');
    var d3 = require("splunkjs/mvc/d3chart/d3/d3.v2");
    var SimpleSplunkView = require("splunkjs/mvc/simplesplunkview");

    require("css!wftoolkit/bubbles.css");

    var Bubbles = SimpleSplunkView.extend({

        className: "splunk-toolkit-bubbles",

        options: {
            mychartid: "search1",   // your MANAGER ID
            data: "preview",  // Results type

            // default values
            nameField: "sourcetype",
            valueField: "count",
            groupingField: "sourcetype"
        },

        output_mode: "json",

        initialize: function() {
            _.extend(this.options, {
                formatName: _.identity,
                formatTitle: function(d) {
                    return (d.source.name + ' -> ' + d.target.name +
                            ': ' + d.value); 
                }
            });
            SimpleSplunkView.prototype.initialize.apply(this, arguments);

            this.settings.enablePush("value");

            // in the case that any options are changed, it will dynamically update
            // without having to refresh. copy the following line for whichever field
            // you'd like dynamic updating on
            this.settings.on("change:nameField", this._onDataChanged, this);
        },

        createView: function() {
            return true;
        },

        // making the data look how we want it to for updateView to do its job
        formatData: function(data) {
            // getting settings
            var nameField = this.settings.get('nameField');
            var valueField = this.settings.get('valueField');
            var groupingField = this.settings.get('groupingField');
            var collection = data;
            var bubblechart = { 'name': nameField+"s", 'children': [ ] }; // how we want it to look

            // making the children formatted array
            for (var i=0; i < collection.length; i++) {
                var Idx = -1;
                $.each(bubblechart.children, function(idx, el) {
                    if (el.name == collection[i][groupingField]) {
                        Idx = idx;
                    }
                });
                if (Idx == -1) {
                    bubblechart.children.push({ 'name': collection[i][groupingField], children: [ ] });
                    Idx = bubblechart.children.length - 1;
                }

                bubblechart.children[Idx].children.push({ 'name': collection[i][nameField], 'size': collection[i][valueField] });
            }
            return bubblechart; // this is passed into updateView as 'data'
        },

        updateView: function(viz, data) {
            var nameField = this.settings.get('nameField'); // this is for the tooltip/click stuff
            var that = this;

            this.$el.html(''); // clearing all prior junk from the view
            // blowing bubbles with d3
            var diameter = Math.min(this.$el.height(), this.$el.width());
                format = d3.format(",d"),
                color = d3.scale.category20c();

            var bubble = d3.layout.pack()
                .sort(null)
                .size([diameter, diameter])
                .padding(1.5);

            d3.select("#" + this.id+ ">svg").remove();
            var svg = d3.select("#" + this.id).append("svg")
                .attr("width", diameter)
                .attr("height", diameter)
                .attr("class", "bubble");

            var tooltip = d3.select("#" + this.id).append("div")
                .attr("class", "bubblesTooltip");

            var node = svg.selectAll(".node")
                .data(bubble.nodes(classes(data))
                .filter(function(d) { return !d.children; }))
                .enter().append("g")
                .attr("class", "node")
                .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

            node.append("title")
                .text(function(d) { return d.className + ": " + format(d.value); });

            node.append("circle")
                .attr("r", function(d) { return d.r; })
                .style("fill", function(d) { return color(d.packageName); });

            node.append("text")
                .attr("dy", ".3em")
                .style("text-anchor", "middle")
                // ensure the text is truncated if the bubble is tiny
                .text(function(d) { return d.className.substring(0, d.r / 3) + ": " + format(d.value); });

            text = svg.selectAll("text")

            // re-flatten the child array
            function classes() {
                var classes = [];
                function recurse(name, node) {
                if (node.children) node.children.forEach(function(child) { recurse(node.name, child); });
                else classes.push({packageName: name, className: node.name, value: node.size});
                }

                recurse(null, data);
                return {children: classes};
            }

            d3.select(self.frameElement).style("height", diameter + "px");

            // tooltips
            function doMouseEnter(d){
                var text;
                if(d.className === undefined){
                    text = "Event: " + d.value;
                } else {
                    text = d.className+": " + d.value;
                }
                tooltip
                    .text(text)
                    .style("opacity", function(){
                        if(d.value !== undefined) { return 1; }
                        return 0;
                    })
                    // .style({left:d.pageX,top:d.pageY});
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY) + "px");
            }

            // more tooltips
            function doMouseOut(d){
                tooltip.style("opacity", 1e-6);
            }

            node.on("mouseover", doMouseEnter);
            node.on("mouseout", doMouseOut);
            
            // drilldown clickings. edit this in order to change the search token that 
            // is set to 'value' (a token in bubbles django), this will change the drilldown
            // search.
            node.on('click', function(e) { 
                that.settings.set("value", nameField+'="'+e.className+'"')
            });
        }
    });
    return Bubbles;
});