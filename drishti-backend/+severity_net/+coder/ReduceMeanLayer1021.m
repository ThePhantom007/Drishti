classdef ReduceMeanLayer1021 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.
    %#codegen

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end

    methods(Static, Hidden)
        % Specify the properties of the class that will not be modified
        % after the first assignment.
        function p = matlabCodegenNontunableProperties(~)
            p = {
                % Constants, i.e., Vars, NumDims and all learnables and states
                'Vars'
                'NumDims'
                };
        end
    end


    methods(Static, Hidden)
        % Instantiate a codegenable layer instance from a MATLAB layer instance
        function this_cg = matlabCodegenToRedirected(mlInstance)
            this_cg = severity_net.coder.ReduceMeanLayer1021(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net.ReduceMeanLayer1021(cgInstance.Name);
            if isstruct(cgInstance.Vars)
                names = fieldnames(cgInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this_ml.Vars.(fieldname) = dlarray(cgInstance.Vars.(fieldname));
                end
            else
                this_ml.Vars = [];
            end
            this_ml.NumDims = cgInstance.NumDims;
        end
    end

    methods
        function this = ReduceMeanLayer1021(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_5_53'};
            if isstruct(mlInstance.Vars)
                names = fieldnames(mlInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this.Vars.(fieldname) = severity_net.coder.ops.extractIfDlarray(mlInstance.Vars.(fieldname));
                end
            else
                this.Vars = [];
            end

            this.NumDims = mlInstance.NumDims;
        end

        function [x_blocks_blocks_5_53] = predict(this, x_blocks_blocks_5_47__)
            if isdlarray(x_blocks_blocks_5_47__)
                x_blocks_blocks_5_47_ = stripdims(x_blocks_blocks_5_47__);
            else
                x_blocks_blocks_5_47_ = x_blocks_blocks_5_47__;
            end
            x_blocks_blocks_5_47NumDims = 4;
            x_blocks_blocks_5_47 = severity_net.coder.ops.permuteInputVar(x_blocks_blocks_5_47_, [4 3 1 2], 4);

            [x_blocks_blocks_5_53__, x_blocks_blocks_5_53NumDims__] = ReduceMeanGraph1063(this, x_blocks_blocks_5_47, x_blocks_blocks_5_47NumDims, false);
            x_blocks_blocks_5_53_ = severity_net.coder.ops.permuteOutputVar(x_blocks_blocks_5_53__, [3 4 2 1], 4);

            x_blocks_blocks_5_53 = dlarray(single(x_blocks_blocks_5_53_), 'SSCB');
        end

        function [x_blocks_blocks_5_53, x_blocks_blocks_5_53NumDims1065] = ReduceMeanGraph1063(this, x_blocks_blocks_5_47, x_blocks_blocks_5_47NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1042 = severity_net.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1064, coder.const(x_blocks_blocks_5_47NumDims));
            xReduced1043 = mean(x_blocks_blocks_5_47, dims1042);
            x_blocks_blocks_5_53 = xReduced1043;
            x_blocks_blocks_5_53NumDims = coder.const(x_blocks_blocks_5_47NumDims);

            % Set graph output arguments
            x_blocks_blocks_5_53NumDims1065 = coder.const(x_blocks_blocks_5_53NumDims);

        end

    end

end