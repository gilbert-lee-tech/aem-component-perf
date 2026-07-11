package com.aemcomponentperf.core.models;

import org.apache.sling.api.SlingHttpServletRequest;
import org.apache.sling.models.annotations.DefaultInjectionStrategy;
import org.apache.sling.models.annotations.Model;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.annotation.PostConstruct;

@Model(
    adaptables = SlingHttpServletRequest.class,
    defaultInjectionStrategy = DefaultInjectionStrategy.OPTIONAL
)
public class SlowTeaserModel {

    private static final Logger log = LoggerFactory.getLogger(SlowTeaserModel.class);

    @PostConstruct
    protected void init() {
        try {
            log.debug("SlowTeaserModel: simulating 6s backend delay");
            Thread.sleep(6_000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
