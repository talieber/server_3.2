function getPOIDetails(DB, POIName){
    return DB.execQuery('SELECT * FROM POI WHERE poi_name = \''+POIName+ '\'')
    // DB.execQuery('SELECT * FROM POI WHERE poi_name = \''+POIName+ '\'')
    // .then(function (result){
    //     return result
    // })
    // .catch(function(err){
    //     console.log(err)
    //     return err
    // })

}

module.exports.getPOIDetails = getPOIDetails