#!/usr/bin/env node

var _ = require('underscore');
var program = require('commander');
var logger = require('./lib/logger');
var package = require('./package.json');
var csv = require('csv');
var fs = require('fs');
var path = require('path');
var xmlwriter = require('xml-writer');
var xml2js = require('xml2js');

program
.version(package.version, '-v, --version')
.description(package.description)
.usage('command <args>');


/*
CSV TO XMLs
*/

program.command('csvtoxml [input]')
.description('Generate XML files from CSV')
.option('-i, --input <csv>', 'CSV file')
.action(function(input) {

	if ( ! input) {
		logger.error('Please set the input');
		process.exit();
	}

	if ( ! fs.existsSync(input)) {
		logger.error('File <' + input + '> does not exists');
		process.exit();
	}

	var csvContent = fs.readFileSync(input, { encoding: 'utf8' });
	csv.parse(csvContent, function(err, data) {
		if (err) {
			logger.error('Failed to parse CSV file');
			process.exit();
		}

		if (data.length === 0) {
			logger.warn('Failed to parse CSV content');
			process.exit();
		}

		var objData = {};
		var languages = [];

		// Create the lang-indexed file
		_.each(data, function(row, index) {
			if (index == 0) {
				_.each(row, function(lang, column) {
					if (column > 0) {
						languages.push(lang);
						objData[lang] = {};
					}
				});
			} else {
				_.each(row, function(str, column) {
					if (column > 0) {
						objData[ languages[column-1] ][ row[0] ] = str;
					}
				});
			}
		});

		// Make the directory
		try {
			fs.mkdirSync('i18n');
		} catch (ex) {}

		// Write the strings.xml
		_.each(objData, function(strings, lang) {
			var xw = new xmlwriter(true);

			xw.startDocument().startElement('resources');
			_.each(strings, function(content, name) {
				xw.startElement('string').writeAttribute('name', name).text(content).endElement();
			});
			xw.endElement().endDocument();

			try {
				fs.mkdirSync(path.join('i18n', lang));
			} catch (ex) {}

			// Write i18n/lang/strings.xml
			fs.writeFileSync(path.join('i18n', lang, 'strings.xml'), xw);

		});

	});

});


/*
XMLs TO CSV
*/

program.command('xmltocsv [output]')
.description('Generate CSV file from XML language files')
.option('-o, --output <csv>', 'CSV file')
.action(function(output) {

	if ( ! output) {
		logger.error('Please set the output');
		process.exit();
	}

	if ( ! fs.existsSync('i18n')) {
		logger.error('i18n directory doesnt not exists');
		process.exit();
	}

	var languages = [];
	_.each(fs.readdirSync('i18n'), function(i18nfile) {
		if (fs.existsSync( path.join('i18n', i18nfile, 'strings.xml') )) {
			languages.push(i18nfile);
		}
	});

	if (languages.length === 0) {
		logger.warn('No language available in i18n directory');
		process.exit()
	}

	var objStrings = {};
	_.each(languages, function(lang) {

		// Read the XMLs
		var xmlContent = fs.readFileSync(path.join('i18n', lang, 'strings.xml'));
		xml2js.parseString(xmlContent, function(err, data) {
			if (err) {
				logger.error('Failed to parse language <' + lang + '>');
				return;
			}

			// Build the object
			_.each(data.resources, function(xmlnodes) {
				_.each(xmlnodes, function(xmlnode) {
					objStrings[ xmlnode.$.name ] = objStrings[ xmlnode.$.name ] || {};
					objStrings[ xmlnode.$.name ][lang] = xmlnode._;
				});
			});
		});

	});

	// Build the object vertical
	var csvData = [ ['key'] ];
	_.each(languages, function(lang) {
		csvData[0].push(lang);
	});
	_.each(objStrings, function(strings, name) {
		var row = [name];
		_.each(languages, function(lang) {
			row.push( strings[lang] || '' );
		});
		csvData.push(row);
	});

	csv.stringify(csvData, function(err, data) {
		if (err) {
			logger.error('Failed to stringify CSV data');
			process.exit();
		}

		fs.writeFileSync(path.join('i18n', output), data);
	});

});


program.parse(process.argv);
if (program.args.length === 0) {
  program.help();
}