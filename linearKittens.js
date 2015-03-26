// Uses owl-deepcopy: http://oranlooney.com/static/javascript/deepCopy.js
// and Numeric Javascript: http://numericjs.com/numeric/index.php
// and UNDERSCORE.js: http://underscorejs.org/
document.body.appendChild(document.createElement('script')).src='http://oranlooney.com/static/javascript/deepCopy.js';
document.body.appendChild(document.createElement('script')).src='http://numericjs.com/numeric/lib/numeric-1.2.6.js';
document.body.appendChild(document.createElement('script')).src='http://underscorejs.org/underscore.js';

// Spawns a new copy of gamePage into gameCopy to manipulate. Takes ~250ms,
// so we should use this sparingly.
function respawnCopy () {
  gameCopy = owl.deepCopy(gamePage);
  gameCopy.village.jobs = owl.deepCopy(gamePage.village.jobs);
}

// refreshTabs asks the game to redraw all the tabs.  We should run this frequently
// to make sure we find all the new buttons
function refreshTabs () {
  for(var i = 0; i<gamePage.tabs.length;i++) {
    gamePage.tabs[i].render();
  }
}

// slices a property across an array.
function getValues (object,property) {
  var resourceNames = [];
  for (var i=0; i<object.length;i++) {
    if (typeof object[i][property] === "undefined") {
      resourceNames.push(0);
    } else {
      resourceNames.push(object[i][property]);
    }
  }
  return resourceNames;
}

// What happens to your resources when you press this button?
// prepay is false if payment handled by btn.handler(), e.g. with crafts
function getSingleTradeRate (button,prepay) {
  // set all current resources to 0.
  setCopyResourcesToZero()

  cost = button.getPrices();
  for(var j=0;j<cost.length;j++) {
    // find the corresponding resource.
    resourceFromName=gameCopy.resPool.get(cost[j].name);
    // set the value to exactly what we need.
    resourceFromName.value = cost[j].val;
  }

  // now try the trade.
  beforeResources = getValues(gameCopy.resPool.resources,"value");
  if (prepay) {button.payPrice();}
  if (button.handler) {
    button.handler(button); // some of these may take 0 arguments, instead
  } else {
    button.onClick();
  }
  afterResources = getValues(gameCopy.resPool.resources,"value");
  deltaResources = numeric.sub(afterResources,beforeResources);
  return deltaResources;
}
function getAverageTradeRate (amt,button,prepay) { //slow.  There should be a faster way.
  if (amt<1) {console.error("getAverageTradeRate: needs positive trade quantity.");}
  var rate = getSingleTradeRate(button,prepay);
  for (var i=1;i<amt;i++) {
    rate = numeric.add(rate,getSingleTradeRate(button,prepay));
  }
  return numeric.div(rate,amt);
}
function setCopyResourcesToZero () {
  resArray = gameCopy.resPool.resources;
  for (var i=0;i<resArray.length;i++) {
    resArray[i].value=0;
  }
}
function getSingelHuntRateWithoutCost () {
  setCopyResourcesToZero()
  beforeResources = getValues(gameCopy.resPool.resources,"value");
  gameCopy.villageTab.sendHunterSquad();
  afterResources = getValues(gameCopy.resPool.resources,"value");
  deltaResources = numeric.sub(afterResources,beforeResources);
  return deltaResources;
}

function getAverageHuntRate (amt) { //because fuck binding
  if (amt<1) {console.error("getAverageTradeRate: needs positive trade quantity.");}
  var rate = getSingelHuntRateWithoutCost();
  for (var i=1;i<amt;i++) {
    rate = numeric.add(rate,getSingelHuntRateWithoutCost());
  }
  var costVec = costToVector(gameCopy.villageTab.huntBtn.prices);
  return numeric.sub(numeric.div(rate,amt),costVec);
}

// compile all the trade-like buttons
// You should probably refreshTabs before this.
function getTradeRates () {
  var buttonlist = []; // a stored list of buttons, in case things change suddenly
  var returns = [];

  // Go through each of the actual trade rates, get the trade values, and
  // store the actual button for gamePage in buttonlist

  //space
  if (gamePage.spaceTab.visible && gamePage.spaceTab.buildRocketBtn.visible) {
    buttonlist.push(gamePage.spaceTab.buildRocketBtn);
    returns.push(getSingleTradeRate(gameCopy.spaceTab.buildRocketBtn,true));
  }

  //hunt
  if (gamePage.villageTab.visible && gamePage.villageTab.huntBtn) {
    buttonlist.push(gamePage.villageTab.huntBtn);
    returns.push(getAverageHuntRate(100));
  }

  //trade
  if (gamePage.diplomacyTab.visible) {
    for (var i=0;i<gamePage.diplomacyTab.racePanels.length;i++) {
      // all the buttons that appear here are visible
      buttonlist.push(gamePage.diplomacyTab.racePanels[i].tradeBtn);
      returns.push(getAverageTradeRate(100,gameCopy.diplomacyTab.racePanels[i].tradeBtn,true));
    }
  }

  //craft
  if (gamePage.workshopTab.visible) {
    for (var i=0;i<gamePage.workshopTab.craftBtns.length;i++) {
      if (gamePage.workshopTab.craftBtns[i].visible) {
        buttonlist.push(gamePage.workshopTab.craftBtns[i]);
        returns.push(getSingleTradeRate(gameCopy.workshopTab.craftBtns[i],false));
      }
    }
  } else {
    // we can still craft catnip
    buttonlist.push(gamePage.workshopTab.craftBtns[0]);
    returns.push(getSingleTradeRate(gameCopy.workshopTab.craftBtns[0],false));
  }

  //religion
  if (gamePage.religionTab.visible) {
    if (gamePage.religionTab.refineBtn.visible) {
      buttonlist.push(gamePage.religionTab.refineBtn);
      returns.push(getSingleTradeRate(gameCopy.religionTab.refineBtn,false));
    }

    if (gamePage.religionTab.sacrificeAlicornsBtn.visible) {
      buttonlist.push(gamePage.religionTab.sacrificeAlicornsBtn);
      returns.push(getSingleTradeRate(gameCopy.religionTab.sacrificeAlicornsBtn,false));
    }

    if (gamePage.religionTab.sacrificeBtn.visible) {
      buttonlist.push(gamePage.religionTab.sacrificeBtn);
      returns.push(getSingleTradeRate(gameCopy.religionTab.sacrificeBtn,false));
    }
  }

  return [buttonlist,returns];
}

// Ask the game to update perTickUI for all resources
// This make break with space production buildings
function recalculateProduction(game) {
  game.village.updateResourceProduction();

  game.village.invalidateCachedEffects();
  game.bld.invalidateCachedEffects();
  game.workshop.invalidateCachedEffects();
  game.religion.invalidateCachedEffects();

  game.updateResources();
}

// Find the production rate associated with a building.
function getProductionRateForBuilding (bld) {
  var togglable = bld.togglable;
  var tunable = bld.tunable;
  if (!togglable && !tunable) {
    return numeric.mul(getValues(gameCopy.resPool.resources,"perTickUI"),0);
  }

  // turn them all off
  bld.on=0;
  recalculateProduction(gameCopy);
  var beforeResources=getValues(gameCopy.resPool.resources,"perTickUI");
  //console.log(beforeResources);

  // turn all of our buildings on
  bld.on=bld.val;

  recalculateProduction(gameCopy);
  var afterResources=getValues(gameCopy.resPool.resources,"perTickUI");
  //console.log(afterResources);

  var deltaResources = numeric.sub(afterResources,beforeResources);

  // turn off again, just because
  bld.on=0;

  return deltaResources;
}

function getNullProductionRate () {
  gameCopy.village.clearJobs();  // reset all kittens first

  var temp = getTogglableBuildings();
  var bldlist = temp[0];
  var copybldlist = temp[1];

  for(i=0;i<copybldlist.length;i++) {
    bld = copybldlist[i];
    // turn them all off
    bld.on=0;
  }
  recalculateProduction(gameCopy);
  var beforeResources=getValues(gameCopy.resPool.resources,"perTickUI");

  return beforeResources;
}


// return the various rates for buildings.  Only include if there is at least
// one of the corresponding building, regardless of unlockness
function getTogglableBuildings () {
  var bldlist = []; // a stored list of buildings, in case things change suddenly
  var copybldlist = [];
  //gamePage.bld.meta[0].meta or gamePage.bld.get(name)
  //gamePage.science.techs,
  //gamePage.workshop.meta[0].meta or gamePage.workshop.getCraft(name),
  //gamePage.religion.meta[0].meta,
  //gamePage.religion.meta[1].meta,
  //gamePage.space.programs

  //space
  array = gamePage.space.programs;
  arraycopy = gameCopy.space.programs;
  if (gamePage.spaceTab.visible) {
    for (var i=0;i<array.length;i++) {
      if (array[i].val>0 && (array[i].togglable||array[i].tunable)) {
        bldlist.push(array[i]);
        copybldlist.push(arraycopy[i]);
      }
    }
  }

  //science
  array = gamePage.science.techs;
  arraycopy = gameCopy.science.techs;
  if (gamePage.libraryTab.visible) {
    for (var i=0;i<array.length;i++) {
      if (array[i].val>0 && (array[i].togglable||array[i].tunable)) {
        bldlist.push(array[i]);
        copybldlist.push(arraycopy[i]);
      }
    }
  }

  //workshop
  meta = gamePage.workshop.meta;
  metacopy = gameCopy.workshop.meta;
  for (var j = 0;j<meta.length;j++) {
    array = meta[j].meta;
    arraycopy = metacopy[j].meta;
    if (gamePage.workshopTab.visible) {
      for (var i=0;i<array.length;i++) {
        if (array[i].val>0 && (array[i].togglable||array[i].tunable)) {
          bldlist.push(array[i]);
          copybldlist.push(arraycopy[i]);
        }
      }
    }
  }

  //religion
  meta = gamePage.religion.meta;
  metacopy = gameCopy.religion.meta;
  for (var j = 0;j<meta.length;j++) {
    array = meta[j].meta;
    arraycopy = metacopy[j].meta;
    if (gamePage.religionTab.visible) {
      for (var i=0;i<array.length;i++) {
        if (array[i].val>0 && (array[i].togglable||array[i].tunable)) {
          bldlist.push(array[i]);
          copybldlist.push(arraycopy[i]);
        }
      }
    }
  }

  //buildings
  meta = gamePage.bld.meta;
  metacopy = gameCopy.bld.meta;
  for (var j = 0;j<meta.length;j++) {
    array = meta[j].meta;
    arraycopy = metacopy[j].meta;
    if (gamePage.libraryTab.visible) {
      for (var i=0;i<array.length;i++) {
        if (array[i].val>0 && (array[i].togglable||array[i].tunable)) {
          bldlist.push(array[i]);
          copybldlist.push(arraycopy[i]);
        }
      }
    }
  }

  return [bldlist,copybldlist];
}

function getBuildingRates() {
  var returns = [];
  var temp = getTogglableBuildings();
  var bldlist = temp[0];
  var copybldlist = temp[1];

  for(var i=0;i<copybldlist.length;i++) {
    returns.push(getProductionRateForBuilding(copybldlist[i]));
  }

  return [bldlist,returns];
}

// Find the production rate associated with a kitten.
function getProductionRateForKitten (job) {
  gameCopy.village.clearJobs();

  recalculateProduction(gameCopy);
  var beforeResources=getValues(gameCopy.resPool.resources,"perTickUI");

  // assign a new kitten
  gameCopy.village.assignJob(job);

  recalculateProduction(gameCopy);
  var afterResources=getValues(gameCopy.resPool.resources,"perTickUI");

  var deltaResources = numeric.sub(afterResources,beforeResources);
  return deltaResources;
}

// return the various rates for kitten production
function getKittenRates () {
  var joblist = []; // a stored list of jobs, in case things change suddenly
  var returns = [];

  if (gamePage.villageTab.visible) {
    for (var i=0;i<gamePage.village.jobs.length;i++) {
      if (gamePage.village.jobs[i].unlocked) {
        joblist.push(gamePage.village.jobs[i]);
        returns.push(getProductionRateForKitten(gameCopy.village.jobs[i]));
      }
    }
  }
  return [joblist,returns];
}

function zeros (n) {return numeric.mul(_.range(n),0);}
function unitVector (n,m) {
  var array = zeros(n);
  array[m]=1;
  return array;
}
function unitVectorVal (n,m,val) {
  var array = zeros(n);
  array[m]=val;
  return array;
}
function costToVector(costs) {
  var resourceNames = getValues(gamePage.resPool.resources,"name");
  var out = zeros(resourceNames.length);
  for(var i = 0;i<costs.length;i++) {
    var name = costs[i].name;
    var val = costs[i].val;

    var index = _.indexOf(resourceNames, name);
    out[index]+=val;
  }
  return out;
}

function getBuildingResearchButtons() {
  // compile a list of visible buttons
  refreshTabs();
  var buttonList = [];
  for (var pi in gamePage.tabs) {
    var tab = gamePage.tabs[pi];
    if (tab.visible) {
      for(var bi in tab.buttons) {
        var button = tab.buttons[bi];
        if (button.visible) {
          buttonList.push(button);
        }
      }
      if (tab.rUpgradeButtons) {
        for(var bi in tab.rUpgradeButtons) {
          var button = tab.rUpgradeButtons[bi];
          if (button.visible) {
            buttonList.push(button);
          }
        }
      }
      if (tab.zgUpgradeButtons) {
        for(var bi in tab.zgUpgradeButtons) {
          var button = tab.zgUpgradeButtons[bi];
          if (button.visible) {
            buttonList.push(button);
          }
        }
      }
      if (tab.GCPanel) {
        tab.GCPanel.update(); // no idea why the fuck we need this
        for(var bi in tab.GCPanel.children) {
          var button = tab.GCPanel.children[bi];
          if (button.visible) {
            buttonList.push(button);
          }
        }
      }
    }
  }

  objects =  [].concat(
    gamePage.bld.meta[0].meta,
    gamePage.science.techs,
    gamePage.workshop.meta[0].meta,
    gamePage.religion.meta[0].meta,
    gamePage.religion.meta[1].meta,
    gamePage.space.programs
  );

  availablebuttons = [];

  transcendenceResearched = gamePage.religion.getRU("transcendence").researched;
  for (var oi in objects) {
    //console.log(oi);
    object = objects[oi];
    if (
      ((object.unlocked) && !(object.researched)) ||
      (object.unlocked && object.upgradable && !object.faith) ||
      (object.faith && object.upgradable && transcendenceResearched)
      ){
      // buildable in theory
      //console.log(object.title,object.label);
      for (var bi=0;bi<buttonList.length;bi++) {
        bu=buttonList[bi];
        if (bu.name==object.title||bu.name==object.label) {break;}
      }
      if (bi<buttonList.length) {
        availablebuttons.push(bu);
      }
    }
  }

  //console.log(getValues(availablebuttons,"name"));
  return availablebuttons;
}


// Duration of a season in seconds
seasonDuration = 200;

// Number of ticks every second
ticksPerSecond = gamePage.rate; //5

// Maximum fraction of resource cap that we can score
resourceFraction = 0.9;

// Threshold for ignoring things in the linear programs
tradeThreshold = 1e-2;

// The most of any building that we can score for completing
maximumBuildingPercentage=1.2;

// The ideal number of trade ships
maxTradeShips=5000;


function getResourceQuantityAndMax () {
  resourceQuantity = getValues(gamePage.resPool.resources,'value');
  resourceMax = getValues(gamePage.resPool.resources,'maxValue');
  for(var i in resourceMax){if (resourceMax[i]==0){resourceMax[i]=Infinity;}}
  resourceMax = numeric.mul(resourceFraction,resourceMax);
}

function getLPParameters (game) {
  maxKittens = game.village.maxKittens;
  numKittens = game.village.getKittens();

  resourceNullRate = getNullProductionRate(); // important that we run this before buildingrates
  getResourceQuantityAndMax();

  var tradesOut = getTradeRates();
  tradeButtons = tradesOut[0];
  tradeReturns = tradesOut[1];
  numTrades = tradeReturns.length;

  var kittensOut = getKittenRates();
  jobList = kittensOut[0];
  jobReturns = kittensOut[1];
  numJobs = jobReturns.length;

  var bldOut = getBuildingRates();
  bldList = bldOut[0];
  bldReturns = bldOut[1];
  numBlds = bldReturns.length;

  numResources = resourceQuantity.length;
}


function numPurchasable(prices) {
  var costVec = costToVector(prices);
  var localResourceQuantity = getValues(gamePage.resPool.resources,'value');
  localResourceQuantity=numeric.max(localResourceQuantity,0);
  var quotient = numeric.div(localResourceQuantity,costVec);
  for (var i in quotient) {
    if (localResourceQuantity[i]==0) {
      if (costVec[i]==0) {quotient[i]=Infinity;} else {quotient[i]=0;}
    }
  }

  return Math.floor(listMin(quotient));
}
function listSum(array) {
  var count=0;
  for (var i=array.length; i--;) {
    count+=array[i];
  }
  return count;
}
function listMin(array) {
  var out=Infinity;
  for (var i=array.length; i--;) {
    if (array[i]<out) {out=array[i];}
  }
  return out;
}

function getJobButton(job) {
  var blist = gamePage.villageTab.buttons;
  for (var i in blist) {
    if (blist[i].name==job.title) {return blist[i];}
  }
  console.error("Failed to find button for job",job.title);
  return null;
}

function listFloor(list,r) {
  return numeric.mul(numeric.floor(numeric.div(list,r)),r);
}

function canExplore() {
  if (!gamePage.diplomacyTab.visible) {return false;}

  var race = gameCopy.diplomacy.unlockRandomRace();
  if (race) {
    respawnCopy();
    return true;
  }
  return false;
}

/* LINEAR PROGRAM
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
This is straightforward.  It adds up a bunch of things
          trades    jobs    blds    res   buttons
1                   1...1                         <=numKittens
numJobs             -I                            <=0
numTrades -I                                      <=0
numBlds                     -I                    <=0
numBlds                      I                    <=1
numButtons                                I       <=maximumBuildingPercentage
numButtons                                -I      <=0
numRes                              I             <=0.9*maxRes
numRes                              -I            <=0
rumRes    -rates    -jobs*T -blds*T I             <=resStart+nullRate*T
numRes                              -I    costs   <=0

objective:                                -1...-1

*/
function isBuildable (costVector, maxResources) {
  for (var i in costVector) {
    if (costVector[i]>resourceMax[i]) {return false;}
  }
  return true;
}

function dRound(x) {
  out = [];
  for (var i in x) {
    var num =x[i];
    out.push(+num.toFixed(2));
  }
  return out;
}
function sRound(num) {return +num.toFixed(2);}

function linearProgram (time) {
  if (!time) {time = 0};
  getResourceQuantityAndMax();
  getLPParameters (gamePage);
  numResources = resourceMax.length;

  // get costs of buildings, but only the ones that are actually buildable.
  buttonList = getBuildingResearchButtons();
  buttonList = buttonList.concat(getExtraButtons());
  buildableButtonList=[];
  var buttonCosts = [];
  for (var i in buttonList) {
    cost = costToVector(buttonList[i].getPrices());
    if (isBuildable(cost,resourceMax)) {
      buttonCosts.push(cost);
      buildableButtonList.push(buttonList[i]);
    }
  }
  numButtons = buttonCosts.length;

  //console.log(getValues(buttonList,"name"));
  console.log("  Considering buttons:", getValues(buildableButtonList,"name"));

  // minimize objective such that matrix.x<=b
  matrixOfInequalities = [];
  objective = [];
  rhs = [];

  // kittens available.
  if (numKittens>0) {
    rhs.push(numKittens);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        numeric.add(zeros(numJobs),1),
        zeros(numBlds),
        zeros(numResources),
        zeros(numButtons)
    ));
  }

  // jobs need at least 0 kittens
  for(var jobNumber = 0;jobNumber<jobReturns.length;jobNumber++) {
    rhs.push(0);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        unitVectorVal(numJobs,jobNumber,-1),
        zeros(numBlds),
        zeros(numResources),
        zeros(numButtons)
    ));
  }

  // Positive number of trades
  for(var tradeNumber = 0;tradeNumber<tradeReturns.length;tradeNumber++) {
    rhs.push(0);
    matrixOfInequalities.push([].concat(
        unitVectorVal(numTrades,tradeNumber,-1),
        zeros(numJobs),
        zeros(numBlds),
        zeros(numResources),
        zeros(numButtons)
    ));
  }

  // buildings need at least 0 fraction active.
  for(var bldNumber = 0;bldNumber<numBlds;bldNumber++) {
    rhs.push(0);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        zeros(numJobs),
        unitVectorVal(numBlds,bldNumber,-1),
        zeros(numResources),
        zeros(numButtons)
    ));
  }

  // buildings need at most 1 fraction active.
  for(var bldNumber = 0;bldNumber<numBlds;bldNumber++) {
    rhs.push(1);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        zeros(numJobs),
        unitVectorVal(numBlds,bldNumber,1),
        zeros(numResources),
        zeros(numButtons)
    ));
  }

  // can't build less than 0 of each button
  for(var buttonNumber = 0;buttonNumber<numButtons;buttonNumber++) {
    rhs.push(0);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        zeros(numJobs),
        zeros(numBlds),
        zeros(numResources),
        unitVectorVal(numButtons,buttonNumber,-1)
    ));
  }

  // can't build more than 1.2 of each button
  for(var buttonNumber = 0;buttonNumber<numButtons;buttonNumber++) {
    rhs.push(maximumBuildingPercentage);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        zeros(numJobs),
        zeros(numBlds),
        zeros(numResources),
        unitVectorVal(numButtons,buttonNumber,1)
    ));
  }

  // can't store more resources than our max
  for(var resNumber = 0;resNumber<numResources;resNumber++) {
    if (resourceMax[resNumber]<Infinity) {
      rhs.push(resourceMax[resNumber]);
      matrixOfInequalities.push([].concat(
          zeros(numTrades),
          zeros(numJobs),
          zeros(numBlds),
          unitVectorVal(numResources,resNumber,1),
          zeros(numButtons)
      ));
    }
  }

  // need at least 0 of each resource
  for(var resNumber = 0;resNumber<numResources;resNumber++) {
    rhs.push(1e-3);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        zeros(numJobs),
        zeros(numBlds),
        unitVectorVal(numResources,resNumber,-1),
        zeros(numButtons)
    ));
  }

  // can't end up with more resources than we produce
  tradeT = numeric.transpose(tradeReturns);
  if (jobReturns.length>0) {jobT = numeric.transpose(jobReturns);} else {jobT=[];for(var i in resourceNullRate) {jobT.push([]);}}
  if (bldReturns.length>0) {bldT = numeric.transpose(bldReturns);} else {bldT=[];for(var i in resourceNullRate) {bldT.push([]);}}
  buttonT = numeric.transpose(buttonCosts);

  for(var i=0;i<resourceNullRate.length;i++) {
    // filter which resources we include: some of them don't work.
    if (resourceQuantity[i]<=0 && resourceNullRate[i]<0){
      rhs.push(1e-4);
    } else {
      rhs.push(resourceQuantity[i]+resourceNullRate[i]*time*ticksPerSecond+1e-4);
    }
    matrixOfInequalities.push([].concat(
      numeric.mul(tradeT[i],-1),
      numeric.mul(jobT[i],-1*time*ticksPerSecond),
      numeric.mul(bldT[i],-1*time*ticksPerSecond),
      unitVectorVal(numResources,i,1),
      zeros(numButtons)
    ));
  }

  // resources must be distributed to buildings
  for(var resNumber = 0;resNumber<numResources;resNumber++) {
    rhs.push(0);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        zeros(numJobs),
        zeros(numBlds),
        unitVectorVal(numResources,resNumber,-1),
        buttonT[resNumber]
    ));
  }

  // Finished all the rows.  Construct the objective.
  objective = [].concat(
    zeros(numTrades),
    zeros(numJobs),
    zeros(numBlds),
    zeros(numResources),
    numeric.add(zeros(numButtons),-1)
  );

  // Run the linear program
  solution = numeric.solveLP(objective,matrixOfInequalities,rhs);
  if(solution.message=="Infeasible") {
    console.log("no solution to the linear program found: defaulting to farming.");
    tradesToDo=zeros(numTrades);
    jobsToDo=zeros(numJobs);
    bldsToDo=zeros(numBlds);
    expectedResources=zeros(numResources);
    buttonCompleteness=zeros(numButtons);

    // everyone should be farming.  This is totally overkill, but it might work better than letting kittens starve
    for (var i in jobsToDo) {
      if (jobList[i].name=="farmer") {jobsToDo[i]=numKittens;}
    }


  } else {
    // turn the solution into actual useful quantities
    ci = 0;
    tradesToDo = solution.solution.slice(ci,ci + numTrades); ci+=numTrades;
    //console.log("unadjustedtrades:",tradesToDo);
    tradesToDo = numeric.ceil(numeric.sub(tradesToDo,tradeThreshold)); // Integerize
    jobsToDo = solution.solution.slice(ci,ci + numJobs); ci+=numJobs;
    bldsToDo = solution.solution.slice(ci,ci + numBlds); ci+=numBlds;
    expectedResources = solution.solution.slice(ci,ci+numResources);ci+=numResources;
    buttonCompleteness = solution.solution.slice(ci,ci+numButtons);ci+=numButtons;
  }

  // Hack for observatories.  They should *always* be on.
  for (var i in bldsToDo) {
    if (bldList[i].name=="observatory") {bldsToDo[i]=1;}
  }

  //console.log("tradesToDo",tradesToDo);
  //console.log("jobsToDo",dRound(jobsToDo));
  //console.log("expectedResources",dRound(expectedResources));
  //console.log("buttonCompleteness",dRound(buttonCompleteness));

  // generate the list of things we are allowed to build
  allowedButtons = [];
  allowedButtonCosts = [];
  for (var i in buildableButtonList) {
    if (buttonCompleteness[i]>=1) {
      allowedButtons.push(buildableButtonList[i]);
      allowedButtonCosts.push(buttonCosts[i]);
    }
  }

  console.log("  Planned constructions:");
  for (var i in buttonCompleteness) {
    if (buttonCompleteness[i]>.001) {
      console.log("   ",buildableButtonList[i].name,Math.round(100*buttonCompleteness[i]),"%");
    }
  }


  //console.log("tradesToDo",tradesToDo);
  console.log("  Job distribution:");
  for (var i in jobsToDo) {
    if(jobsToDo[i]>.005) {console.log("   ",jobList[i].title,":",sRound(jobsToDo[i]));}
  }

  console.log("  Trades:");
  printTrades();

  //console.log("  Partial constructions:")
  //for (var i in allowedButtons) {
  //  console.log("   ",allowedButtons[i].name);
  //}
  //console.log("buttonCompleteness",dRound(buttonCompleteness));

  return;
}

/* MAIN LOOP
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
There are a few main loops:
1 activates whenever we build a building or every hour.
    Update everything.
    Figure out what the next building we should be is
    Runs loop 2.
2 activates every 10 minutes or so.
    Run the second linear program
    run loop 3
3 activates every second or so
    try to make trades that we need to do
    update the distribution of jobs and buildings.
4 activates every second or so and clicks on log events
5 activates every second or so and converts faith if close to the cap
*/
function getExtraButtons() {
  out = [];
  if (!gamePage.bld.get("library").unlocked) {
    bb = {
      name:"Buying extra wood",
      getPrices:function () {return [{name:"wood",val:10}];},
      onClick: function(){}
    };
    out.push(bb);
  }

  if (gamePage.resPool.get("megalith").value < 10 && !gamePage.bld.get("ziggurat").unlocked) {
    bb = {
      name:"Buying extra megaliths",
      getPrices:function () {return [{name:"megalith",val:10}];},
      onClick: function(){}
    };
    out.push(bb);
  }

  // explore.  Note that
  if (canExplore()) {
    bb = gamePage.diplomacyTab.exploreBtn;
    out.push(bb);
  }


  numShips = gamePage.resPool.get("ship").value;
  desiredShips = Math.min(Math.max(2*numShips,25),maxTradeShips);
  if (numShips<maxTradeShips) {
    bb = {
      name:"Buying some trade ships",
      getPrices:function () {return [{name:"ship",val:desiredShips}];},
      onClick: function(){}
    };
    out.push(bb);
  }

  return out;
}

function planLoop () {
  clearTimeout(planLoopTimeout);planLoopTimeout=false;
  if (linearKittensOn) {planLoopTimeout=setTimeout(planLoop, 60*1000);}

  console.log ("PLANNING LOOP");
  planningloopseason = gamePage.calendar.season;
  planningloopweather = gamePage.calendar.weather;

  refreshTabs();
  respawnCopy();
  getLPParameters(gamePage);

  buttonList = getBuildingResearchButtons();
  buttonList = buttonList.concat(getExtraButtons());

  console.log("  Attempting linear program.");

  out = linearProgram(60);
  //if (out == "Infeasible") {
  //  clearTimeout(planLoopTimeout);planLoopTimeout=false;
  //  if (linearKittensOn) {planLoopTimeout=setTimeout(planLoop, 60*1000);}
  //  console.log("  Planning loop failed to find solution to linear program.  Trying again later.")
  //  return;
  //}

}

function printTrades() {
  for (var i in tradesToDo) {
    if (tradesToDo[i]>0) {
      if (tradeButtons[i].race) {
        console.log("   ",tradeButtons[i].race.name,":",tradesToDo[i]);
      } else {
        console.log("   ",tradeButtons[i].name,":",tradesToDo[i]);
      }
    }
  }
}

// Do this every second
loop3Counter = 0;
function executeLoop () {
  loop3Counter=(loop3Counter+1)%10

  console.log ("EXECUTION LOOP");
  console.log("  Remaining trades:");
  printTrades();

  // try to do all the trades. TODO make this faster by incorporating multiplicity
  for (var i in tradesToDo) {
    //console.log(tradesToDo[i]);
    if (tradesToDo[i]>0) {
      // atempt to perform the trade.
      var button = tradeButtons[i];
      var costs = button.getPrices();
      var canBuild = numPurchasable(costs);
      //console.log(costs,canBuild);
      canBuild = Math.min(canBuild,tradesToDo[i])
      tradesToDo[i]-=canBuild;
      if (canBuild>0) {
        if (button.craftName) {
          //console.log("crafting resources.");
          gamePage.craft(button.craftName,canBuild);
        } else if (button.race) {
          //console.log("trading multiple");
          button.tradeMultiple(canBuild);
        } else {
          //try to trade one at a time...
          console.log(button.name, canBuild);
          for (var i=0;i<canBuild;i++) {
            // hunts need to be treated differently, for some reason.
            if (button.name=="Send hunters") {
              button.payPrice();
              gamePage.villageTab.sendHunterSquad()
            } else {
              if (button.handler) {button.handler(button);} else {button.onClick();}
            }
          }
        }
      }

    }
  }

  // set a bunch of buildings to the appropriate state.  Skip the buttons.
  for(var i in bldList) {
    var bld = bldList[i];
    var fOn = bldsToDo[i];
    if (!bld.tunable) {
      // all on or all off
      if  (fOn>loop3Counter/10) {bld.on=bld.val;} else {bld.on=0;}
    } else {
      //actually tunable
      var shouldBeOn = fOn*bld.val;
      var alwaysOn = Math.floor(shouldBeOn);
      var lastone = shouldBeOn-alwaysOn;
      if  (lastone>loop3Counter/10) {bld.on=alwaysOn+1;} else {bld.on=alwaysOn;}
    }
  }

  // assign kittens to the appropriate jobs
  // do so cleverly, or something, by minimizing number of operations.
  var toJobs = numeric.max(numeric.floor(jobsToDo),0);
  var totalJobs = listSum(toJobs);
  if (totalJobs>numKittens) { //game.village.getKittens();
    console.error("  Too many jobs to assign to kittens.");
    return;
  }
  // fuck the last kitten
  if (totalJobs<numKittens) {
    currentCDF=0;
    for (var i in jobsToDo) {
      currentCDF+=jobsToDo[i]-toJobs[i];
      if (currentCDF>.1+(loop3Counter/10.01)) {
        toJobs[i]++
        break;
      }
    }
  }

  // remove kittens from jobs
  for ( i in toJobs) {
    idealJobs = toJobs[i];
    job = jobList[i];
    if (job.value>idealJobs) {
      getJobButton(job).unassignJobs(job.value-idealJobs);
      getJobButton(job).update();
    }
  }
  // add kittens to jobs
  for ( i in toJobs) {
    idealJobs = toJobs[i];
    job = jobList[i];
    if (job.value<idealJobs) {
      getJobButton(job).assignJobs(idealJobs-job.value);
      getJobButton(job).update();
    }
  }

  // Check whether we can build any of the the buildings
  for (i in allowedButtons) {
    var buildButton = allowedButtons[i];
    buttonPrices=buildButton.getPrices();
    var canBuild = numPurchasable(buttonPrices);
    if (canBuild>0) {
      console.log("  Constructing",buildButton.name);
      buildButton.onClick();
      setTimeout(planLoop,1);
      return;
    }
  }


  //If we changed season, we should run loop2 again.
  if(planningloopseason != gamePage.calendar.season||planningloopweather!=gamePage.calendar.weather) {
    console.log("  Season changed. Running the planning loop.");
    if (linearKittensOn) {planLoop();}
  }
}

// in a new game, click the gather catnip button
function autoCatnipFunction() {
  if (gamePage.bld.get("field").val>0) {return;}
  buttons = gamePage.bonfireTab.buttons;
  if (buttons.length==0) {return;}
  for (var b in buttons) {
    if (buttons[b].name=="Gather catnip") {
      buttons[b].handler(buttons[b]);
    }
  }
}

//starclick and autopray by Browsing_From_Work from https://www.reddit.com/r/kittensgame/comments/2eqlt5/a_few_kittens_game_scripts_ive_put_together/
//clearInterval(starClick);clearInterval(autoPray);
function starClickFunction () { $("#gameLog").find("input").click(); }
function autoPrayFunction() {  //modified autopray
    var origTab = gamePage.activeTabId;
    var faith = gamePage.resPool.get('faith');

    // no spending faith if we're saving up for it.
    if ("testCosts" in window) {
      for(i in testCosts) {
        if (testCosts[i].name == "faith") {return;}
      }
    }

    if (faith.value / faith.maxValue > 0.90) {
        gamePage.activeTabId = 'Religion'; gamePage.render();
        $(".btnContent:contains('Praise the sun')").click();
        gamePage.activeTabId = origTab; gamePage.render();
    }
}

linearKittensOn = false;
starClick=false;
autopray=false
autoCatnip=false;
executeInterval = false;
planLoopTimeout=false;
function startLinearKittens() {
  if (linearKittensOn) {console.log("linearKittens already started."); return;}

  linearKittensOn = true;
  autoCatnip = setInterval(autoCatnipFunction,2000);
  starClick = setInterval(starClickFunction, 1 * 1000);
  autopray = setInterval(autoPrayFunction,10*1000);

  planLoop();
  executeInterval = setInterval(executeLoop,5*1000);

}

function stopLinearKittens() {
  linearKittensOn = false;
  clearInterval(autoCatnip);
  clearInterval(starClick);
  clearInterval(autopray);
  clearInterval(executeInterval);
}
